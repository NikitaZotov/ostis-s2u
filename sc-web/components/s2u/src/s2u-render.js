S2u.Render = function () {
    this.scene = null;
};

S2u.Render.prototype = {

    init: function (params) {
        this.containerId = params.containerId;
        this.sandbox = params.sandbox;

        this.linkBorderWidth = 1;
        this.scale = 1;
        this.translate = [0, 0];
        this.translate_started = false;

        // disable tooltips
        $('#' + this.containerId).parent().addClass('ui-no-tooltip');

        var s2uViewer = $('#s2u-viewer');
        this.d3_drawer = d3.select('#' + this.containerId)
            .append("svg:svg")
            .attr("pointer-events", "all")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("class", "S2uSvg")
            .on('mousemove', function () {
                self.onMouseMove(this, self);
            })
            .on('mousedown', function () {
                self.onMouseDown(this, self)
            })
            .on('mouseup', function () {
                self.onMouseUp(this, self);
            })
            .on('dblclick', function () {
                self.onMouseDoubleClick(this, self);
            });

        this.scale = 1;
        var self = this;
        this.d3_container = this.d3_drawer.append('svg:g')
            .attr("class", "S2uSvg");

        this.initDefs();

        /* this.d3_container.append('svg:rect')
         .style("fill", "url(#backGrad)")
         .attr('width', '10000') //parseInt(this.d3_drawer.style("width")))
         .attr('height', '10000');//parseInt(this.d3_drawer.style("height")));
         */

        this.d3_drag_line = this.d3_container.append('svg:path')
            .attr('class', 'dragline hidden')
            .attr('d', 'M0,0L0,0');
        this.d3_contour_line = d3.svg.line().interpolate("cardinal-closed");
        this.d3_contours = this.d3_container.append('svg:g').selectAll('path');
        this.d3_accept_point = this.d3_container.append('svg:use')
            .attr('class', 'S2uAcceptPoint hidden')
            .attr('xlink:href', '#acceptPoint')
            .on('mouseover', function (d) {
                d3.select(this).classed('S2uAcceptPointHighlighted', true);
            })
            .on('mouseout', function (d) {
                d3.select(this).classed('S2uAcceptPointHighlighted', false);
            })
            .on('mousedown', function (d) {
                self.scene.listener.finishCreation();
                d3.event.stopPropagation();
            });
        this.d3_edges = this.d3_container.append('svg:g').selectAll('path');
        this.d3_buses = this.d3_container.append('svg:g').selectAll('path');
        this.d3_nodes = this.d3_container.append('svg:g').selectAll('g');
        this.d3_links = this.d3_container.append('svg:g').selectAll('g');
        this.d3_dragline = this.d3_container.append('svg:g');
        this.d3_line_points = this.d3_container.append('svg:g');

        this.line_point_idx = -1;
    },

    // -------------- Definitions --------------------
    initDefs: function () {
        // define arrow markers for graph links
        var defs = this.d3_drawer.append('svg:defs')

        S2uAlphabet.initSvgDefs(defs, this.containerId);

        var grad = defs.append('svg:radialGradient')
            .attr('id', 'backGrad')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '100%').attr("spreadMethod", "pad");

        grad.append('svg:stop')
            .attr('offset', '0%')
            .attr('stop-color', 'rgb(255,253,252)')
            .attr('stop-opacity', '1')
        grad.append('svg:stop')
            .attr('offset', '100%')
            .attr('stop-color', 'rgb(245,245,245)')
            .attr('stop-opacity', '1')

        // line point control
        var p = defs.append('svg:g')
            .attr('id', 'linePoint')
        p.append('svg:circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 10);

        p = defs.append('svg:g')
            .attr('id', 'acceptPoint')
        p.append('svg:circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 10)
        p.append('svg:path')
            .attr('d', 'M-5,-5 L0,5 5,-5');
        p = defs.append('svg:g')
            .attr('id', 'removePoint')
        p.append('svg:circle')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', 10)

        p.append('svg:path')
            .attr('d', 'M-5,-5L5,5M-5,5L5,-5');
    },

    classState: function (obj, base) {

        var res = 'sc-no-default-cmd ui-no-tooltip S2uElement';

        if (base)
            res += ' ' + base;

        if (obj.is_selected)
            res += ' S2uStateSelected';

        if (obj.is_highlighted)
            res += ' S2uStateHighlighted ';

        switch (obj.state) {
            case S2uObjectState.FromMemory:
                res += ' S2uStateFromMemory';
                break;
            case S2uObjectState.MergedWithMemory:
                res += ' S2uStateMergedWithMemory';
                break;
            case S2uObjectState.NewInMemory:
                res += ' S2uStateNewInMemory';
                break;
            default:
                res += ' S2uStateNormal';
        }
        ;

        return res;
    },

    classToogle: function (o, cl, flag) {

        var item = d3.select(o);
        var str = item.attr("class");
        var res = str ? str.replace(cl, '') : '';
        res = res.replace('  ', ' ');
        if (flag)
            res += ' ' + cl;
        item.attr("class", res);
    },

    // -------------- draw -----------------------
    update: function () {

        var self = this;

        function eventsWrap(selector) {
            selector.on('mouseover', function (d) {
                self.classToogle(this, 'S2uStateHighlighted', true);
                if (self.scene.onMouseOverObject(d))
                    d3.event.stopPropagation();
            })
                .on('mouseout', function (d) {
                    self.classToogle(this, 'S2uStateHighlighted', false);
                    if (self.scene.onMouseOutObject(d))
                        d3.event.stopPropagation();
                })
                .on('mousedown', function (d) {
                    self.scene.onMouseDownObject(d);
                    if (d3.event.stopPropagation())
                        d3.event.stopPropagation();
                })
                .on('mouseup', function (d) {
                    self.scene.onMouseUpObject(d);
                    if (d3.event.stopPropagation())
                        d3.event.stopPropagation();
                })
        };

        function appendNodeVisual(g) {
            g.append('svg:use')
                .attr('xlink:href', function (d) {
                    return '#' + S2uAlphabet.getDefId(d.sc_type);
                })
                .attr('class', 'sc-no-default-cmd ui-no-tooltip');
        };


        // add nodes that haven't visual
        this.d3_nodes = this.d3_nodes.data(this.scene.nodes, function (d) {
            return d.id;
        });

        var g = this.d3_nodes.enter().append('svg:g')
            .attr('class', function (d) {
                return self.classState(d, (d.sc_type & sc_type_constancy_mask) ? 'S2uNode' : 'S2uNodeEmpty');
            })
            .attr("transform", function (d) {
                return 'translate(' + d.position.x + ', ' + d.position.y + ')';
            });
        eventsWrap(g);
        appendNodeVisual(g);

        g.append('svg:text')
            .attr('class', 'S2uText')
            .attr('x', function (d) {
                return d.scale.x / 1.3;
            })
            .attr('y', function (d) {
                return d.scale.y / 1.3;
            })
            .text(function (d) {
                return d.text;
            });

        this.d3_nodes.exit().remove();

//        // add links that haven't visual
//        this.d3_links = this.d3_links.data(this.scene.links, function (d) {
//            return d.id;
//        });
//
//        g = this.d3_links.enter().append('svg:g')
//            .attr("transform", function (d) {
//                return 'translate(' + d.position.x + ', ' + d.position.y + ')';
//            })
//
//        g.append('svg:rect')
//            .attr('class', function (d) {
//                return self.classState(d, 'S2uLink');
//            })
//            .attr('class', 'sc-no-default-cmd ui-no-tooltip');
//
//        g.append('svg:foreignObject')
//            .attr('transform', 'translate(' + self.linkBorderWidth * 0.5 + ',' + self.linkBorderWidth * 0.5 + ')')
//            .attr("width", "100%")
//            .attr("height", "100%")
//            .append("xhtml:link_body")
//            .style("background", "transparent")
//            .style("margin", "0 0 0 0")
//            .html(function (d) {
//                return '<div id="link_' + self.containerId + '_' + d.id + '" class=\"S2uLinkContainer\"><div id="' + d.containerId + '" style="display: inline-block;" class="impl"></div></div>';
//            });
//
//
//        eventsWrap(g);
//
//        this.d3_links.exit().remove();

        // add links that haven't visual
        this.d3_links = this.d3_links.data(this.scene.links, function (d) {
            return d.id;
        });

        g = this.d3_links.enter().append('svg:g')
            .attr("transform", function (d) {
                return 'translate(' + d.position.x + ', ' + d.position.y + ')';
            })
            .attr('id', function (d) {
                return 'link_' + self.containerId + '_' + d.id;
            })
            .html(function (d) {
                let htmlCode = S2uObjectsHandler.getElementTemplateForObject(d.sc_addr);
                let ids = S2uObjectsHandler.getMatches(htmlCode, S2uObjectsHandler.TEMPLATE_REGEX);
                ids.forEach((id) => {
                    htmlCode = htmlCode.replace(`#{${id}}`, d.mapIdf[id]);
                });
                return htmlCode;
            });

        eventsWrap(g);

        this.d3_links.exit().remove();

        // update edges visual
        this.d3_edges = this.d3_edges.data(this.scene.edges, function (d) {
            return d.id;
        });

        // add edges that haven't visual
        g = this.d3_edges.enter().append('svg:g')
            .attr('class', function (d) {
                return self.classState(d, 'S2uEdge');
            })
            .attr('pointer-events', 'visibleStroke');

        eventsWrap(g);

        this.d3_edges.exit().remove();

        // update contours visual
        this.d3_contours = this.d3_contours.data(this.scene.contours, function (d) {
            return d.id;
        });

        g = this.d3_contours.enter().append('svg:polygon')
            .attr('class', function (d) {
                return self.classState(d, 'S2uContour');
            })
            .attr('points', function (d) {
                var verticiesString = "";
                for (var i = 0; i < d.points.length; i++) {
                    var vertex = d.points[i].x + ', ' + d.points[i].y + ' ';
                    verticiesString = verticiesString.concat(vertex);
                }
                return verticiesString;
            })
            .attr('title', function (d) {
                return d.text;
            });
        eventsWrap(g);

        this.d3_contours.exit().remove();

        // update buses visual
        this.d3_buses = this.d3_buses.data(this.scene.buses, function (d) {
            return d.id;
        });

        g = this.d3_buses.enter().append('svg:g')
            .attr('class', function (d) {
                return self.classState(d, 'S2uBus');
            })
            .attr('pointer-events', 'visibleStroke');
        eventsWrap(g);

        this.d3_buses.exit().remove();

        this.updateObjects();
    },


    // -------------- update objects --------------------------
    updateObjects: function () {

        var self = this;
        this.d3_nodes.each(function (d) {

            if (!d.need_observer_sync) return; // do nothing

            d.need_observer_sync = false;

            var g = d3.select(this)
                .attr("transform", 'translate(' + d.position.x + ', ' + d.position.y + ')')
                .attr('class', function (d) {
                    return self.classState(d, (d.sc_type & sc_type_constancy_mask) ? 'S2uNode' : 'S2uNodeEmpty');
                })

            g.select('use')
                .attr('xlink:href', function (d) {
                    return '#' + S2uAlphabet.getDefId(d.sc_type);
                })
                .attr("sc_addr", function (d) {
                    return d.sc_addr;
                });

            g.selectAll('text').text(function (d) {
                return d.text;
            });
        });

//        this.d3_links.each(function (d) {
//
//            if (!d.need_observer_sync && d.contentLoaded) return; // do nothing
//
//            if (!d.contentLoaded) {
//                var links = {};
//                links[d.containerId] = d.sc_addr;
//                self.sandbox.createViewersForScLinks(links);
//
//                d.contentLoaded = true;
//            }
//            else
//                d.need_observer_sync = false;
//
//            var linkDiv = $(document.getElementById("link_" + self.containerId + "_" + d.id));
//            if (!d.sc_addr) {
//                linkDiv.find('.impl').html(d.content);
//            } else {
//                if (d.content != "") {
//                    linkDiv.find('.impl').html(d.content);
//                } else {
//                    d.content = linkDiv.find('.impl').html();
//                    if (d.content != "") {
//                        d.setAutoType();
//                    }
//                }
//            }
//
//            var g = d3.select(this)
//
//            g.select('rect')
//                .attr('width', function (d) {
//                    d.scale.x = Math.min(linkDiv.find('.impl').outerWidth(), 450) + 10;
//                    return d.scale.x + self.linkBorderWidth;
//                })
//                .attr('height', function (d) {
//                    d.scale.y = Math.min(linkDiv.outerHeight(), 350);
//                    return d.scale.y + self.linkBorderWidth;
//                })
//                .attr('class', function (d) {
//                    return self.classState(d, 'S2uLink');
//                }).attr("sc_addr", function (d) {
//                return d.sc_addr;
//            });
//
//            g.selectAll(function () {
//                return this.getElementsByTagName("foreignObject");
//            })
//                .attr('width', function (d) {
//                    return d.scale.x;
//                })
//                .attr('height', function (d) {
//
//                    return d.scale.y;
//                });
//
//            g.attr("transform", function (d) {
//                return 'translate(' + (d.position.x - (d.scale.x + self.linkBorderWidth) * 0.5) + ', ' + (d.position.y - (d.scale.y + self.linkBorderWidth) * 0.5) + ')';
//            });
//
//        });

        this.d3_links.each(function (d) {

            if (!d.need_observer_sync && d.contentLoaded) return; // do nothing

            d.need_observer_sync = false;

            let g = d3.select(this);

            g.attr("sc_addr", function (d) {
                return d.sc_addr;
            });

            g.attr('class', function (d) {
                return 'sc-no-default-cmd ui-no-tooltip';
            });

            let htmlG = $(document.getElementById("link_" + self.containerId + "_" + d.id));

            g.attr('width', function (d) {
                d.scale.x = htmlG.find('.S2UBorderRect').get(0).getBBox().width;
                return d.scale.x;
            });

            g.attr('height', function (d) {
                d.scale.y = htmlG.find('.S2UBorderRect').get(0).getBBox().height;
                return d.scale.y;
            });

            g.attr("position.x", function (d) {
                return d.position.x;
            });

            g.attr("position.y", function (d) {
                return d.position.y;
            });

            g.attr("transform", function (d) {
                return 'translate(' + (d.position.x - (d.scale.x + self.linkBorderWidth) * 0.5) + ', ' + (d.position.y - (d.scale.y + self.linkBorderWidth) * 0.5) + ')';
            });

        });

        this.d3_edges.each(function (d) {

            if (!d.need_observer_sync) return; // do nothing
            d.need_observer_sync = false;

            if (d.need_update)
                d.update();
            var d3_edge = d3.select(this);
            S2uAlphabet.updateEdgeS2U(d, d3_edge, self.containerId);
            d3_edge.attr('class', function (d) {
                return self.classState(d, 'S2uEdge');
            })
                .attr("sc_addr", function (d) {
                    return d.sc_addr;
                });
        });

        this.d3_contours.each(function (d) {

            d3.select(this).attr('d', function (d) {

                if (!d.need_observer_sync) return; // do nothing

                if (d.need_update)
                    d.update();

                var d3_contour = d3.select(this);

                d3_contour.attr('class', function (d) {
                    return self.classState(d, 'S2uContour');
                });

                d3_contour.attr('points', function (d) {
                    var verticiesString = "";
                    for (var i = 0; i < d.points.length; i++) {
                        var vertex = d.points[i].x + ', ' + d.points[i].y + ' ';
                        verticiesString = verticiesString.concat(vertex);
                    }
                    return verticiesString;
                });

                d3_contour.attr('title', function (d) {
                    return d.text;
                });

                d.need_update = false;
                d.need_observer_sync = false;

                return self.d3_contour_line(d.points) + 'Z';
            })
                .attr("sc_addr", function (d) {
                    return d.sc_addr;
                });
        });

        this.d3_buses.each(function (d) {

            if (!d.need_observer_sync) return; // do nothing
            d.need_observer_sync = false;

            if (d.need_update)
                d.update();
            var d3_bus = d3.select(this);
            S2uAlphabet.updateBus(d, d3_bus);
            d3_bus.attr('class', function (d) {
                return self.classState(d, 'S2uBus');
            });
        });

        this.updateLinePoints();
    },

    updateTexts: function () {
        this.d3_nodes.select('text').text(function (d) {
            return d.text;
        });
    },

    updateLinksTexts: function () {
        this.d3_links.each(function (d) {
            let g = d3.select(this);
            g.html(function (d) {
                let htmlCode = S2uObjectsHandler.getElementTemplateForObject(d.sc_addr);
                let ids = S2uObjectsHandler.getMatches(htmlCode, S2uObjectsHandler.TEMPLATE_REGEX);
                ids.forEach((id) => {
                    htmlCode = htmlCode.replace(`#{${id}}`, d.mapIdf[id]);
                });
                return htmlCode;
            })
        });
    },

    requestUpdateAll: function () {
        this.d3_nodes.each(function (d) {
            d.need_observer_sync = true;
        });
        this.d3_links.each(function (d) {
            d.need_observer_sync = true;
        });
        this.d3_edges.each(function (d) {
            d.need_observer_sync = true;
            d.need_update = true;
        });
        this.d3_contours.each(function (d) {
            d.need_observer_sync = true;
            d.need_update = true;
        });
        this.d3_buses.each(function (d) {
            d.need_observer_sync = true;
            d.need_update = true;
        });
        this.update();
    },

    updateDragLine: function () {
        var self = this;


        this.d3_drag_line.classed('S2uBus', this.scene.edit_mode == S2uEditMode.S2uModeBus)
            .classed('dragline', true)
            .classed('draglineBus', this.scene.edit_mode == S2uEditMode.S2uModeBus);

        // remove old points
        drag_line_points = this.d3_dragline.selectAll('use.S2uRemovePoint');
        points = drag_line_points.data(this.scene.drag_line_points, function (d) {
            return d.idx;
        })
        points.exit().remove();

        points.enter().append('svg:use')
            .attr('class', 'S2uRemovePoint')
            .attr('xlink:href', '#removePoint')
            .attr('transform', function (d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
            .on('mouseover', function (d) {
                d3.select(this).classed('S2uRemovePointHighlighted', true);
            })
            .on('mouseout', function (d) {
                d3.select(this).classed('S2uRemovePointHighlighted', false);
            })
            .on('mousedown', function (d) {
                self.scene.revertDragPoint(d.idx);
                d3.event.stopPropagation();
            });


        if (this.scene.edit_mode == S2uEditMode.S2uModeBus || this.scene.edit_mode == S2uEditMode.S2uModeContour) {
            this.d3_accept_point.classed('hidden', this.scene.drag_line_points.length == 0);
            if (this.scene.drag_line_points.length > 0) {
                var pos = this.scene.drag_line_points[0];
                if (this.scene.edit_mode == S2uEditMode.S2uModeBus)
                    pos = this.scene.drag_line_points[this.scene.drag_line_points.length - 1];
                this.d3_accept_point.attr('transform', 'translate(' + (pos.x + 24) + ',' + pos.y + ')');
            }
        } else {
            this.d3_accept_point.classed('hidden', true);
        }

        if (this.scene.drag_line_points.length < 1) {
            this.d3_drag_line.classed('hidden', true);
        } else {

            this.d3_drag_line.classed('hidden', false);

            var d_str = '';
            // create path description
            for (idx in this.scene.drag_line_points) {
                var pt = this.scene.drag_line_points[idx];

                if (idx == 0)
                    d_str += 'M';
                else
                    d_str += 'L';
                d_str += pt.x + ',' + pt.y;
            }

            d_str += 'L' + this.scene.mouse_pos.x + ',' + this.scene.mouse_pos.y;

            // update drag line
            this.d3_drag_line.attr('d', d_str);
        }
    },

    updateLinePoints: function () {
        var self = this;
        var oldPoints;

        line_points = this.d3_line_points.selectAll('use');
        points = line_points.data(this.scene.line_points, function (d) {
            return d.idx;
        })
        points.exit().remove();

        if (this.scene.line_points.length == 0)
            this.line_points_idx = -1;

        points.enter().append('svg:use')
            .classed('S2uLinePoint', true)
            .attr('xlink:href', '#linePoint')
            .attr('transform', function (d) {
                return 'translate(' + d.pos.x + ',' + d.pos.y + ')';
            })
            .on('mouseover', function (d) {
                d3.select(this).classed('S2uLinePointHighlighted', true);
            })
            .on('mouseout', function (d) {
                d3.select(this).classed('S2uLinePointHighlighted', false);
            })
            .on('mousedown', function (d) {
                if (self.line_point_idx < 0) {
                    oldPoints = $.map(self.scene.selected_objects[0].points, function (vertex) {
                        return $.extend({}, vertex);
                    });
                    self.line_point_idx = d.idx;
                } else {
                    var newPoints = $.map(self.scene.selected_objects[0].points, function (vertex) {
                        return $.extend({}, vertex);
                    });
                    self.scene.commandManager.execute(new S2uCommandMovePoint(self.scene.selected_objects[0],
                        oldPoints,
                        newPoints,
                        self.scene),
                        true);
                    self.line_point_idx = -1;
                }
            })
            .on('dblclick', function (d) {
                self.line_point_idx = -1;
            });
        /*.on('mouseup', function(d) {
         self.scene.pointed_object = null;
         });*/

        line_points.each(function (d) {
            d3.select(this).attr('transform', function (d) {
                return 'translate(' + d.pos.x + ',' + d.pos.y + ')';
            });
        });
    },

    _changeContainerTransform: function (translate, scale) {
        this.d3_container.attr("transform", "translate(" + this.translate + ")scale(" + this.scale + ")");
    },

    changeScale: function (mult) {
        if (mult === 0)
            throw "Invalid scale multiplier";

        this.scale *= mult;
        var scale = Math.max(2, Math.min(0.1, this.scale));
        this._changeContainerTransform();
    },

    changeTranslate: function (delta) {

        this.translate[0] += delta[0] * this.scale;
        this.translate[1] += delta[1] * this.scale;

        this._changeContainerTransform();
    },

    // --------------- Events --------------------
    _correctPoint: function (p) {
        p[0] -= this.translate[0];
        p[1] -= this.translate[1];

        p[0] /= this.scale;
        p[1] /= this.scale;
        return p;
    },

    onMouseDown: function (window, render) {
        var point = this._correctPoint(d3.mouse(window));
        if (render.scene.onMouseDown(point[0], point[1]))
            return;

        this.translate_started = true;
    },

    onMouseUp: function (window, render) {

        if (this.translate_started) {
            this.translate_started = false;
            return;
        }

        var point = this._correctPoint(d3.mouse(window));

        if (this.line_point_idx >= 0) {
            this.line_point_idx = -1;
            d3.event.stopPropagation();
            return;
        }

        if (render.scene.onMouseUp(point[0], point[1]))
            d3.event.stopPropagation();
    },

    onMouseMove: function (window, render) {

        if (this.translate_started)
            this.changeTranslate([d3.event.movementX, d3.event.movementY]);

        var point = this._correctPoint(d3.mouse(window));

        if (this.line_point_idx >= 0) {
            this.scene.setLinePointPos(this.line_point_idx, {x: point[0], y: point[1]});
            d3.event.stopPropagation();
        }

        if (render.scene.onMouseMove(point[0], point[1]))
            d3.event.stopPropagation();
    },

    onMouseDoubleClick: function (window, render) {
        var point = this._correctPoint(d3.mouse(window));
        if (this.scene.onMouseDoubleClick(point[0], point[1]))
            d3.event.stopPropagation();
    },

    onKeyDown: function (event) {
        // do not send event to other listeners, if it processed in scene
        if (this.scene.onKeyDown(event))
            d3.event.stopPropagation();
    },

    onKeyUp: function (event) {
        // do not send event to other listeners, if it processed in scene
        if (this.scene.onKeyUp(event))
            d3.event.stopPropagation();
    },

    // ------- help functions -----------
    getContainerSize: function () {
        var el = document.getElementById(this.containerId);
        return [el.clientWidth, el.clientHeight];
    }


}
