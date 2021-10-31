function S2uFromScImpl(sandbox, editor, arcMapping)
{
    const self = this;

    let tasks = [],
        batch = null,
        tasksLength = 0;

    function resolveIdtf(addr, obj)
    {
        sandbox.getIdentifier(addr, function (idtf)
        {
            obj.setText(idtf);
        });
    }

    function randomPosition()
    {
        return new S2u.Vector3(100 * Math.random(), 100 * Math.random(), 0);
    }

    const doBatch = function ()
    {
        if (!batch)
        {
            if (!tasks.length || tasksLength === tasks.length)
            {
                window.clearInterval(self.timeout);
                self.timeout = 0;
                return;
            }
            batch = tasks.splice(0, Math.max(150, tasks.length));
            tasksLength = tasks.length;
        }

        if (batch)
        {
            for (let i = 0; i < batch.length; ++i)
            {
                const task = batch[i],
                      addr = task[0],
                      type = task[1];

                if (editor.scene.getObjectByScAddr(addr))
                {
                    continue;
                }

                if (type && sc_type_node)
                {
                    const model_node = S2u.Creator.createNode(type, randomPosition(), '');
                    editor.scene.appendNode(model_node);
                    editor.scene.objects[addr] = model_node;
                    model_node.setScAddr(addr);
                    model_node.setObjectState(S2uObjectState.FromMemory);
                    resolveIdtf(addr, model_node);
                }
                else if (type && sc_type_arc_mask)
                {
                    const bObj = editor.scene.getObjectByScAddr(task[2]);
                    const eObj = editor.scene.getObjectByScAddr(task[3]);
                    if (!bObj || !eObj)
                    {
                        tasks.push(task);
                    }
                    else
                    {
                        const model_edge = S2u.Creator.createEdge(bObj, eObj, type);
                        editor.scene.appendEdge(model_edge);
                        editor.scene.objects[addr] = model_edge;
                        model_edge.setScAddr(addr);
                        model_edge.setObjectState(S2uObjectState.FromMemory);
                        resolveIdtf(addr, model_edge);
                    }
                }
                else if (type && sc_type_link)
                {
                    const containerId = 's2u-window-' + sandbox.addr + '-' + addr + '-' + new Date().getUTCMilliseconds();
                    const model_link = S2u.Creator.createLink(randomPosition(), containerId);
                    editor.scene.appendLink(model_link);
                    editor.scene.objects[addr] = model_link;
                    model_link.setScAddr(addr);
                    model_link.setObjectState(S2uObjectState.FromMemory);
                }
            }

            editor.render.update();
            editor.scene.layout();

            batch = null;
        }
    };

    const addTask = function (task)
    {
        tasks.push(task);
        if (!self.timeout)
        {
            self.timeout = window.setInterval(doBatch, 10);
        }
        doBatch();
    };

    const removeElement = function (addr)
    {
        const obj = editor.scene.getObjectByScAddr(addr);
        if (obj)
        {
            editor.scene.deleteObjects([obj]);
        }

        editor.render.update();
        editor.scene.layout();
    };

    return {
        update: function (added, element, arc)
        {
            if (added) {
                window.sctpClient.get_arc(arc).done(function (r)
                {
                    const elem = r[1];
                    window.sctpClient.get_element_type(elem).done(function (task)
                    {
                        arcMapping[arc] = elem;
                        if (task && (sc_type_node || sc_type_link))
                        {
                            addTask([elem, task]);
                        }
                        else if (task && sc_type_arc_mask)
                        {
                            window.sctpClient.get_arc(elem).done(function (result)
                            {
                                addTask([elem, task, result[0], result[1]]);
                            });
                        }
                        else
                        {
                            throw "Unknown element type " + task;
                        }
                    });
                });
            }
            else
            {
                const elem = arcMapping[arc];
                if (elem)
                {
                    removeElement(elem);
                }
            }
        }
    };

}


function s2uScStructTranslator(editor, sandbox)
{
    let arcMapping = {};

    if (!sandbox.is_struct)
    {
        throw "Sandbox must to work with sc-struct";
    }

    const s2uFromSc = new S2uFromScImpl(sandbox, editor, arcMapping);

    const appendToConstruction = function (obj)
    {
        const deferred = new jQuery.Deferred();

        window.sctpClient.create_arc(sc_type_arc_pos_const_perm, sandbox.addr, obj.sc_addr).done(function (addr)
        {
            arcMapping[addr] = obj;
            deferred.resolve();
        }).fail(function ()
        {
            deferred.reject();
        });

        return deferred.promise();
    };

    const currentLanguage = sandbox.getCurrentLanguage();

    const translateIdentifier = function (obj)
    {
        const deferred = new jQuery.Deferred();
        if (currentLanguage)
        {
            window.sctpClient.create_link().done(function (link_addr)
            {
                window.sctpClient.set_link_content(link_addr, obj.text).done(function ()
                {
                    window.sctpClient.create_arc(sc_type_arc_common | sc_type_const, obj.sc_addr,
                        link_addr).done(function (arc_addr)
                    {
                        window.sctpClient.create_arc(sc_type_arc_pos_const_perm,
                            currentLanguage, link_addr).done(function ()
                        {
                            window.sctpClient.create_arc(sc_type_arc_pos_const_perm,
                                window.scKeynodes.nrel_main_idtf, arc_addr)
                                .done(deferred.resolve)
                                .fail(deferred.reject);
                        }).fail(deferred.reject);
                    }).fail(deferred.reject);
                }).fail(deferred.reject);
            }).fail(deferred.reject);

        }
        else
        {
            deferred.reject();
        }

        return deferred.promise();
    };

    return {
            mergedWithMemory: function (obj)
            {
                if (!obj.sc_addr)
                {
                    throw "Invalid parameter";
                }

                window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                    [sandbox.addr, sc_type_arc_pos_const_perm, obj.sc_addr]
                ).done(function (result)
                {
                    if (result.length === 0)
                    {
                        appendToConstruction(obj);
                    }
                });
            },
            updateFromSc: function (added, element, arc)
            {
                s2uFromSc.update(added, element, arc);
            },

            translateToSc: function (callback)
            {
                if (!sandbox.is_struct)
                {
                    throw "Invalid state. Trying translate sc-link into sc-memory";
                }

                editor.scene.commandManager.clear();
                let nodes = editor.scene.nodes.slice();
                let links = editor.scene.links.slice();
                let buses = editor.scene.buses.slice();
                let objects = [];


                const appendObjects = function ()
                {
                    $.when.apply($, objects.map(function (obj)
                    {
                        return appendToConstruction(obj);
                    })).done(function ()
                    {
                        callback(true);
                    }).fail(function ()
                    {
                        callback(false);
                    });
                };

                function fireCallback()
                {
                    editor.render.update();
                    editor.scene.layout();
                    appendObjects();
                }

                const translateNodes = function ()
                {
                    const deferredNodes = new jQuery.Deferred();

                    const implFunc = function (node)
                    {
                        const deferred = new jQuery.Deferred();

                        if (!node.sc_addr)
                        {
                            window.sctpClient.create_node(node.sc_type).done(function (result)
                            {
                                node.setScAddr(result);
                                node.setObjectState(S2uObjectState.NewInMemory);
                                objects.push(node);

                                if (node.text)
                                {
                                    translateIdentifier(node)
                                        .done(deferred.resolve)
                                        .fail(deferred.reject);
                                }
                                else
                                {
                                    deferred.resolve();
                                }
                            })
                        }
                        else
                        {
                            deferred.resolve();
                        }

                        return deferred.promise();
                    };

                    let funcs = [];
                    for (let i = 0; i < nodes.length; ++i)
                    {
                        funcs.push(fQueue.Func(implFunc, [nodes[i]]));
                    }

                    fQueue.Queue.apply(this, funcs).done(deferredNodes.resolve).fail(deferredNodes.reject);

                    return deferredNodes.promise();
                };

                const preTranslateContoursAndBus = function ()
                {
                    const deferred = new jQuery.Deferred();

                    // create sc-struct nodes
                    const scAddrGen = function (object)
                    {
                        const deferred1 = new jQuery.Deferred();

                        if (object.sc_addr)
                        {
                            deferred1.resolve();
                        }
                        else
                        {
                            window.sctpClient.create_node(sc_type_const | sc_type_node |
                                sc_type_node_struct).done(function (node)
                            {
                                object.setScAddr(node);
                                object.setObjectState(S2uObjectState.NewInMemory);
                                objects.push(object);

                                if (object.text)
                                {
                                    translateIdentifier(object)
                                        .done(deferred1.resolve)
                                        .fail(deferred1.reject);
                                }
                                else
                                {
                                    deferred1.resolve();
                                }
                            });
                        }

                        return deferred1.promise();
                    };

                    let funcs = [];
                    for (let i = 0; i < editor.scene.contours.length; ++i)
                    {
                        editor.scene.contours[i].addNodesWhichAreInContourPolygon(editor.scene.nodes);
                        editor.scene.contours[i].addNodesWhichAreInContourPolygon(editor.scene.links);
                        editor.scene.contours[i].addEdgesWhichAreInContourPolygon(editor.scene.edges);
                        funcs.push(fQueue.Func(scAddrGen, [editor.scene.contours[i]]));
                    }

                    for (let bus_number = 0; bus_number < buses.length; ++bus_number)
                    {
                        buses[bus_number].setScAddr(buses[bus_number].source.sc_addr);
                    }

                    // run tasks
                    fQueue.Queue.apply(this, funcs).done(deferred.resolve).fail(deferred.reject);

                    return deferred.promise();
                };

                const translateEdges = function ()
                {
                    let deferred = new jQuery.Deferred();

                    // translate edges
                    let edges = [];
                    editor.scene.edges.map(function (e)
                    {
                        if (!e.sc_addr)
                        {
                            edges.push(e);
                        }
                    });

                    let newEdges = [];
                    let translatedCount = 0;

                    function doIteration()
                    {
                        let edge = edges.shift();

                        function nextIteration()
                        {
                            if (edges.length === 0)
                            {
                                if (translatedCount === 0 || (edges.length === 0 && newEdges.length === 0))
                                {
                                    deferred.resolve();
                                }
                                else
                                {
                                    edges = newEdges;
                                    newEdges = [];
                                    translatedCount = 0;
                                    window.setTimeout(doIteration, 0);
                                }
                            }
                            else
                            {
                                window.setTimeout(doIteration, 0);
                            }
                        }

                        if (edge.sc_addr)
                        {
                            throw "Edge already have sc-addr";
                        }

                        const src = edge.source.sc_addr;
                        const trg = edge.target.sc_addr;

                        if (src && trg)
                        {
                            window.sctpClient.create_arc(edge.sc_type, src, trg).done(function (result)
                            {
                                edge.setScAddr(result);
                                edge.setObjectState(S2uObjectState.NewInMemory);

                                objects.push(edge);
                                translatedCount++;
                                nextIteration();
                            }).fail(function ()
                            {
                                console.log('Error while create arc');
                            });
                        }
                        else
                        {
                            newEdges.push(edge);
                            nextIteration();
                        }

                    }

                    if (edges.length > 0)
                    {
                        window.setTimeout(doIteration, 0);
                    }
                    else
                    {
                        deferred.resolve();
                    }

                    return deferred.promise();
                };

                const translateContours = function ()
                {
                    const deferredContours = new jQuery.Deferred();

                    // now need to process arcs from contours to child elements
                    const arcGen = function (contour, child)
                    {
                        const deferred = new jQuery.Deferred();

                        window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                            [contour.sc_addr, sc_type_arc_pos_const_perm, child.sc_addr])
                            .done(deferred.resolve)
                            .fail(function ()
                            {
                                window.sctpClient.create_arc(sc_type_arc_pos_const_perm, contour.sc_addr,
                                    child.sc_addr).done(deferred.resolve).fail(deferred.reject);
                            });

                        return deferred.promise();
                    };

                    let acrFuncs = [];
                    for (let i = 0; i < editor.scene.contours.length; ++i)
                    {
                        let contour = editor.scene.contours[i];
                        for (let j = 0; j < contour.childs.length; ++j)
                        {
                            acrFuncs.push(fQueue.Func(arcGen, [contour, contour.childs[j]]));
                        }
                    }

                    fQueue.Queue.apply(this, acrFuncs).done(deferredContours.resolve).fail(deferredContours.reject);

                    return deferredContours.promise();
                };

                const translateLinks = function ()
                {
                    const deferredLinks = new jQuery.Deferred();

                    const implFunc = function (link)
                    {
                        const deferred = new jQuery.Deferred();

                        if (!link.sc_addr)
                        {
                            window.sctpClient.create_link().done(function (result)
                            {
                                link.setScAddr(result);
                                link.setObjectState(S2uObjectState.NewInMemory);

                                let content = link.content;
                                let keynode = null;

                                if (link.contentType === 'float')
                                {
                                    const float32 = new Float32Array(1);
                                    float32[0] = parseFloat(link.content);
                                    content = float32.buffer;
                                    keynode = window.scKeynodes.binary_float;
                                }
                                else if (link.contentType === 'int8')
                                {
                                    const int8 = new Int8Array(1);
                                    int8[0] = parseInt(link.content);
                                    content = int8.buffer;
                                    keynode = window.scKeynodes.binary_int8;
                                }
                                else if (link.contentType === 'int16')
                                {
                                    const int16 = new Int16Array(1);
                                    int16[0] = parseInt(link.content);
                                    content = int16.buffer;
                                    keynode = window.scKeynodes.binary_int16;
                                }
                                else if (link.contentType === 'int32')
                                {
                                    const int32 = new Int32Array(1);
                                    int32[0] = parseInt(link.content);
                                    content = int32.buffer;
                                    keynode = window.scKeynodes.binary_int32;
                                }
                                else if (link.contentType === 'image')
                                {
                                    content = link.fileReaderResult;
                                    keynode = window.scKeynodes.format_png;
                                }
                                else if (link.contentType === 'html')
                                {
                                    content = link.fileReaderResult;
                                    keynode = window.scKeynodes.format_html;
                                }
                                else if (link.contentType === 'pdf')
                                {
                                    content = link.fileReaderResult;
                                    keynode = window.scKeynodes.format_pdf;
                                }

                                objects.push(link);

                                window.sctpClient.set_link_content(result, content);
                                if (link.fileReaderResult)
                                {
                                    window.scHelper.setLinkFormat(result, keynode);
                                }
                                else
                                {
                                    window.sctpClient.create_arc(sc_type_arc_pos_const_perm, keynode, result);
                                }
                                deferred.resolve();
                            });
                        }
                        else
                        {
                            deferred.resolve();
                        }

                        return deferred.promise();
                    };

                    let funcs = [];
                    for (let i = 0; i < links.length; ++i)
                    {
                        funcs.push(fQueue.Func(implFunc, [links[i]]));
                    }

                    fQueue.Queue.apply(this, funcs).done(deferredLinks.resolve).fail(deferredLinks.reject);

                    return deferredLinks.promise();
                };

                fQueue.Queue(
                    /* Translate nodes */
                    fQueue.Func(translateNodes),
                    fQueue.Func(translateLinks),
                    fQueue.Func(preTranslateContoursAndBus),
                    fQueue.Func(translateEdges),
                    fQueue.Func(translateContours)
                ).done(fireCallback);

            }
        };
}