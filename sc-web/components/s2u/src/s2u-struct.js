function S2uFromScImpl(sandbox, editor, arcMapping)
{
    var self = this;

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
                            window.sctpClient.get_arc(elem).done(function (r)
                            {
                                addTask([elem, task, r[0], r[1]]);
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


//! TODO: refactoring
function s2uScStructTranslator(_editor, _sandbox) {
    var r, editor = _editor,
        sandbox = _sandbox,
        tasks = [],
        processBatch = false,
        taskDoneCount = 0,
        arcMapping = {};

    if (!sandbox.is_struct)
        throw "Snadbox must to work with sc-struct";

    var s2uFromSc = new S2uFromScImpl(sandbox, editor, arcMapping);

    var appendToConstruction = function (obj) {
        var dfd = new jQuery.Deferred();
        window.sctpClient.create_arc(sc_type_arc_pos_const_perm, sandbox.addr, obj.sc_addr).done(function (addr) {
            arcMapping[addr] = obj;
            dfd.resolve();
        }).fail(function () {
            dfd.reject();
        });
        return dfd.promise();
    };

    var currentLanguage = sandbox.getCurrentLanguage();
    var translateIdentifier = function (obj) {
        var dfd = new jQuery.Deferred();
        if (currentLanguage) {
            window.sctpClient.create_link().done(function (link_addr) {
                window.sctpClient.set_link_content(link_addr, obj.text).done(function () {
                    window.sctpClient.create_arc(sc_type_arc_common | sc_type_const, obj.sc_addr,
                        link_addr).done(function (arc_addr) {
                        window.sctpClient.create_arc(sc_type_arc_pos_const_perm,
                            currentLanguage, link_addr).done(function () {
                            window.sctpClient.create_arc(sc_type_arc_pos_const_perm,
                                window.scKeynodes.nrel_main_idtf, arc_addr)
                                .done(dfd.resolve)
                                .fail(dfd.reject);
                        }).fail(dfd.reject);
                    }).fail(dfd.reject);
                }).fail(dfd.reject);
            }).fail(dfd.reject);

        } else {
            dfd.reject();
        }
        return dfd.promise();
    };

    return r = {
        mergedWithMemory: function (obj) {
            if (!obj.sc_addr)
                throw "Invalid parameter";

            window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_3F_A_F, [sandbox.addr,
                sc_type_arc_pos_const_perm, obj.sc_addr
            ]).done(function (r) {
                if (r.length == 0) {
                    appendToConstruction(obj);
                }
            });
        },
        updateFromSc: function (added, element, arc) {
            s2uFromSc.update(added, element, arc);
        },

        translateToSc: function (callback) {
            if (!sandbox.is_struct)
                throw "Invalid state. Trying translate sc-link into sc-memory";

            var dfdNodes = jQuery.Deferred();

            editor.scene.commandManager.clear();
            var nodes = editor.scene.nodes.slice();
            var links = editor.scene.links.slice();
            var buses = editor.scene.buses.slice();
            var objects = [];


            var appendObjects = function () {
                $.when.apply($, objects.map(function (obj) {
                    return appendToConstruction(obj);
                })).done(function () {
                    callback(true);
                }).fail(function () {
                    callback(false);
                });
            };

            function fireCallback() {
                editor.render.update();
                editor.scene.layout();
                appendObjects();
            }


            /// --------------------
            var translateNodes = function () {
                var dfdNodes = new jQuery.Deferred();

                var implFunc = function (node) {
                    var dfd = new jQuery.Deferred();

                    if (!node.sc_addr) {
                        window.sctpClient.create_node(node.sc_type).done(function (r) {
                            node.setScAddr(r);
                            node.setObjectState(S2uObjectState.NewInMemory);
                            objects.push(node);
                            if (node.text) {
                                translateIdentifier(node)
                                    .done(dfd.resolve)
                                    .fail(dfd.reject);
                            } else {
                                dfd.resolve();
                            }
                        });
                    } else {
                        dfd.resolve();
                    }

                    return dfd.promise();
                }

                var funcs = [];
                for (var i = 0; i < nodes.length; ++i) {
                    funcs.push(fQueue.Func(implFunc, [nodes[i]]));
                }

                fQueue.Queue.apply(this, funcs).done(dfdNodes.resolve).fail(dfdNodes.reject);

                return dfdNodes.promise();
            }

            var preTranslateContoursAndBus = function () {
                var dfd = new jQuery.Deferred();

                // create sc-struct nodes
                var scAddrGen = function (c) {
                    var dfd = new jQuery.Deferred();

                    if (c.sc_addr)
                        dfd.resolve();
                    else {
                        window.sctpClient.create_node(sc_type_const | sc_type_node |
                            sc_type_node_struct).done(function (node) {
                            c.setScAddr(node);
                            c.setObjectState(S2uObjectState.NewInMemory);
                            objects.push(c);
                            if (c.text) {
                                translateIdentifier(c)
                                    .done(dfd.resolve)
                                    .fail(dfd.reject);
                            } else {
                                dfd.resolve();
                            }
                        });
                    }

                    return dfd.promise();
                };
                var funcs = [];
                for (var i = 0; i < editor.scene.contours.length; ++i) {
                    editor.scene.contours[i].addNodesWhichAreInContourPolygon(editor.scene.nodes);
                    editor.scene.contours[i].addNodesWhichAreInContourPolygon(editor.scene.links);
                    editor.scene.contours[i].addEdgesWhichAreInContourPolygon(editor.scene.edges);
                    funcs.push(fQueue.Func(scAddrGen, [editor.scene.contours[i]]));
                }

                for (var number_bus = 0; number_bus < buses.length; ++number_bus) {
                    buses[number_bus].setScAddr(buses[number_bus].source.sc_addr);
                }

                // run tasks
                fQueue.Queue.apply(this, funcs).done(dfd.resolve).fail(dfd.reject);

                return dfd.promise();
            }

            /// --------------------
            var translateEdges = function () {
                var dfd = new jQuery.Deferred();

                // translate edges
                var edges = [];
                editor.scene.edges.map(function (e) {
                    if (!e.sc_addr)
                        edges.push(e);
                });

                var edgesNew = [];
                var translatedCount = 0;

                function doIteration() {
                    var edge = edges.shift();

                    function nextIteration() {
                        if (edges.length === 0) {
                            if (translatedCount === 0 || (edges.length === 0 && edgesNew.length === 0))
                                dfd.resolve();
                            else {
                                edges = edgesNew;
                                edgesNew = [];
                                translatedCount = 0;
                                window.setTimeout(doIteration, 0);
                            }
                        } else
                            window.setTimeout(doIteration, 0);
                    };

                    if (edge.sc_addr)
                        throw "Edge already have sc-addr";

                    var src = edge.source.sc_addr;
                    var trg = edge.target.sc_addr;

                    if (src && trg) {
                        window.sctpClient.create_arc(edge.sc_type, src, trg).done(function (r) {
                            edge.setScAddr(r);
                            edge.setObjectState(S2uObjectState.NewInMemory);

                            objects.push(edge);
                            translatedCount++;
                            nextIteration();
                        }).fail(function () {
                            console.log('Error while create arc');
                        });
                    } else {
                        edgesNew.push(edge);
                        nextIteration();
                    }

                }

                if (edges.length > 0)
                    window.setTimeout(doIteration, 0);
                else
                    dfd.resolve();

                return dfd.promise();
            }

            var translateContours = function () {
                var dfdContours = new jQuery.Deferred();

                // now need to process arcs from contours to child elements
                var arcGen = function (contour, child) {
                    var dfd = new jQuery.Deferred();

                    window.sctpClient.iterate_elements(SctpIteratorType.SCTP_ITERATOR_3F_A_F, [contour.sc_addr,
                        sc_type_arc_pos_const_perm, child.sc_addr
                    ])
                        .done(dfd.resolve)
                        .fail(function () {
                            window.sctpClient.create_arc(sc_type_arc_pos_const_perm, contour.sc_addr,
                                child.sc_addr).done(dfd.resolve).fail(dfd.reject);
                        });

                    return dfd.promise();
                };

                var acrFuncs = [];
                for (var i = 0; i < editor.scene.contours.length; ++i) {
                    var c = editor.scene.contours[i];
                    for (var j = 0; j < c.childs.length; ++j) {
                        acrFuncs.push(fQueue.Func(arcGen, [c, c.childs[j]]));
                    }
                }

                fQueue.Queue.apply(this, acrFuncs).done(dfdContours.resolve).fail(dfdContours.reject);

                return dfdContours.promise();
            }

            /// --------------------
            var translateLinks = function () {
                var dfdLinks = new jQuery.Deferred();

                var implFunc = function (link) {
                    var dfd = new jQuery.Deferred();

                    if (!link.sc_addr) {
                        window.sctpClient.create_link().done(function (r) {
                            link.setScAddr(r);
                            link.setObjectState(S2uObjectState.NewInMemory);

                            var content = link.content;
                            var keynode = null;
                            if (link.contentType === 'float') {
                                var float32 = new Float32Array(1);
                                float32[0] = parseFloat(link.content);
                                content = float32.buffer;
                                keynode = window.scKeynodes.binary_float;
                            } else if (link.contentType === 'int8') {
                                var int8 = new Int8Array(1);
                                int8[0] = parseInt(link.content);
                                content = int8.buffer;
                                keynode = window.scKeynodes.binary_int8;
                            } else if (link.contentType === 'int16') {
                                var int16 = new Int16Array(1);
                                int16[0] = parseInt(link.content);
                                content = int16.buffer;
                                keynode = window.scKeynodes.binary_int16;
                            } else if (link.contentType === 'int32') {
                                var int32 = new Int32Array(1);
                                int32[0] = parseInt(link.content);
                                content = int32.buffer;
                                keynode = window.scKeynodes.binary_int32;
                            } else if (link.contentType === 'image') {
                                content = link.fileReaderResult;
                                keynode = window.scKeynodes.format_png;
                            } else if (link.contentType === 'html') {
                                content = link.fileReaderResult;
                                keynode = window.scKeynodes.format_html;
                            } else if (link.contentType === 'pdf') {
                                content = link.fileReaderResult;
                                keynode = window.scKeynodes.format_pdf;
                            }

                            objects.push(link);

                            window.sctpClient.set_link_content(r, content);
                            if (link.fileReaderResult) {
                                window.scHelper.setLinkFormat(r, keynode);
                            } else {
                                window.sctpClient.create_arc(sc_type_arc_pos_const_perm,
                                    keynode, r);
                            }
                            dfd.resolve();
                        });
                    } else {
                        dfd.resolve();
                    }

                    return dfd.promise();
                }

                var funcs = [];
                for (var i = 0; i < links.length; ++i) {
                    funcs.push(fQueue.Func(implFunc, [links[i]]));
                }

                fQueue.Queue.apply(this, funcs).done(dfdLinks.resolve).fail(dfdLinks.reject);

                return dfdLinks.promise();
            }

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
};