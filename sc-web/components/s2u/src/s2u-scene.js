var S2uEditMode = {
    S2uModeSelect: 0,
    S2uModeEdge: 1,
    S2uModeBus: 2,
    S2uModeContour: 3,
    S2uModeLink: 4,

    /**
     * Check if specified mode is valid
     */
    isValid: function (mode) {
        return (mode >= this.S2uModeSelect) && (mode <= this.S2uModeContour);
    }
};

var clipS2uText = "clipS2uText";

var S2uModalMode = {
    S2uModalNone: 0,
    S2uModalIdtf: 1,
    S2uModalType: 2
};

var KeyCode = {
    Escape: 27,
    Enter: 13,
    Delete: 46,
    Key1: 49,
    Key2: 50,
    Key3: 51,
    Key4: 52,
    Key5: 53,
    KeyMinusFirefox: 173,
    KeyMinus: 189,
    KeyMinusNum: 109,
    KeyEqualFirefox: 61,
    KeyEqual: 187,
    KeyPlusNum: 107,
    A: 65,
    C: 67,
    I: 73,
    T: 84,
    V: 86,
    Z: 90
};

var S2uTypeEdgeNow = sc_type_arc_pos_const_perm;
var S2uTypeNodeNow = sc_type_node | sc_type_const;

S2u.Scene = function (options) {

    this.listener_array = [new S2uSelectListener(this),
        new S2uEdgeListener(this),
        new S2uBusListener(this),
        new S2uContourListener(this),
        new S2uLinkListener(this)];
    this.listener = this.listener_array[0];
    this.commandManager = new S2uCommandManager();
    this.render = options.render;
    this.edit = options.edit;
    this.nodes = [];
    this.links = [];
    this.edges = [];
    this.contours = [];
    this.buses = [];

    this.objects = Object.create(null);
    this.edit_mode = S2uEditMode.S2uModeSelect;

    // object, that placed under mouse
    this.pointed_object = null;
    // object, that was mouse pressed
    this.focused_object = null;

    // list of selected objects
    this.selected_objects = [];

    // drag line points
    this.drag_line_points = [];
    // points of selected line object
    this.line_points = [];

    // mouse position
    this.mouse_pos = new S2u.Vector3(0, 0, 0);

    // edge source and target
    this.edge_data = {source: null, target: null};

    // bus source
    this.bus_data = {source: null, end: null};

    // callback for selection changed
    this.event_selection_changed = null;
    // callback for modal state changes
    this.event_modal_changed = null;

    /* Flag to lock any edit operations
     * If this flag is true, then we doesn't need to process any editor operatons, because
     * in that moment shows modal dialog
     */
    this.modal = S2uModalMode.S2uModalNone;
};

S2u.Scene.prototype = {

    constructor: S2u.Scene,

    init: function () {
        this.layout_manager = new S2u.LayoutManager();
        this.layout_manager.init(this);
    },

    /**
     * Appends new sc.g-node to scene
     * @param {S2u.ModelNode} node Node to append
     */
    appendNode: function (node) {
        this.nodes.push(node);
        node.scene = this;
    },

    appendLink: function (link) {
        this.links.push(link);
        link.scene = this;
    },

    /**
     * Appends new sc.g-edge to scene
     * @param {S2u.ModelEdge} edge Edge to append
     */
    appendEdge: function (edge) {
        this.edges.push(edge);
        edge.scene = this;
    },

    /**
     * Append new sc.g-contour to scene
     * @param {S2u.ModelContour} contour Contour to append
     */
    appendContour: function (contour) {
        this.contours.push(contour);
        contour.scene = this;
    },

    /**
     * Append new sc.g-contour to scene
     * @param {S2u.ModelBus} bus Bus to append
     */
    appendBus: function (bus) {
        this.buses.push(bus);
        bus.scene = this;
    },

    appendObject: function (obj) {
        if (obj instanceof S2u.ModelNode) {
            this.appendNode(obj);
        } else if (obj instanceof S2u.ModelLink) {
            this.appendLink(obj);
        } else if (obj instanceof S2u.ModelEdge) {
            this.appendEdge(obj);
        } else if (obj instanceof S2u.ModelContour) {
            this.appendContour(obj);
        } else if (obj instanceof S2u.ModelBus) {
            this.appendBus(obj);
            obj.setSource(obj.source);
        }
    },

    /**
     * Remove object from scene.
     * @param {S2u.ModelObject} obj Object to remove
     */
    removeObject: function (obj) {
        var self = this;

        function remove_from_list(obj, list) {
            var idx = list.indexOf(obj);
            if (idx < 0) {
                S2uDebug.error("Can't find object for remove");
                return;
            }
            if (self.pointed_object == obj) {
                self.pointed_object = null;
            }
            list.splice(idx, 1);
        }

        if (obj instanceof S2u.ModelNode) {
            remove_from_list(obj, this.nodes);
        } else if (obj instanceof S2u.ModelLink) {
            remove_from_list(obj, this.links);
        } else if (obj instanceof S2u.ModelEdge) {
            remove_from_list(obj, this.edges);
        } else if (obj instanceof S2u.ModelContour) {
            remove_from_list(obj, this.contours);
        } else if (obj instanceof S2u.ModelBus) {
            remove_from_list(obj, this.buses);
            obj.destroy();
        }
    },

    // --------- objects destroy -------

    /**
     * Delete objects from scene
     * @param {Array} objects Array of sc.g-objects to delete
     */
    deleteObjects: function (objects) {
        var self = this;

        function collect_objects(container, root) {
            if (container.indexOf(root) >= 0)
                return;

            container.push(root);
            for (idx in root.edges) {
                if (self.edges.indexOf(root.edges[idx]) > -1) collect_objects(container, root.edges[idx]);
            }

            if (root.bus)
                if (self.buses.indexOf(root.bus) > -1) collect_objects(container, root.bus);

            if (root instanceof S2u.ModelContour) {
                for (var numberChildren = 0; numberChildren < root.childs.length; numberChildren++) {
                    if (self.nodes.indexOf(root.childs[numberChildren]) > -1) {
                        collect_objects(container, root.childs[numberChildren]);
                    }
                }
            }
        }

        // collect objects for remove
        var objs = [];

        // collect objects for deletion
        for (var idx in objects)
            collect_objects(objs, objects[idx]);

        this.commandManager.execute(new S2uCommandDeleteObjects(objs, this));

        this.updateRender();
    },

    /**
     * Updates render
     */
    updateRender: function () {
        this.render.update();
    },

    /**
     * Updates render objects state
     */
    updateObjectsVisual: function () {
        this.render.updateObjects();
    },

    // --------- layout --------
    layout: function () {
        this.layout_manager.doLayout();
        this.render.update();
    },

    onLayoutTick: function () {
    },

    /**
     * Returns size of container, where graph drawing
     */
    getContainerSize: function () {
        return this.render.getContainerSize();
    },

    /**
     * Return array that contains sc-addrs of all objects in scene
     */
    getScAddrs: function () {
        var keys = new Array();
        for (key in this.objects) {
            keys.push(key);
        }
        return keys;
    },

    /**
     * Return object by sc-addr
     * @param {String} addr sc-addr of object to find
     * @return If object founded, then return it; otherwise return null
     */
    getObjectByScAddr: function (addr) {
        if (Object.prototype.hasOwnProperty.call(this.objects, addr))
            return this.objects[addr];

        return null;
    },

    /**
     * Selection all object
     */
    selectAll: function () {
        var self = this;
        var allObjects = [this.nodes, this.edges, this.buses, this.contours, this.links];
        allObjects.forEach(function (setObjects) {
            setObjects.forEach(function (obj) {
                if (!obj.is_selected) {
                    self.selected_objects.push(obj);
                    obj._setSelected(true);
                }
            });
        });
        this.updateObjectsVisual();
        this._fireSelectionChanged();
    },

    /**
     * Append selection to object
     */
    appendSelection: function (obj) {
        if (obj.is_selected) {
            var idx = this.selected_objects.indexOf(obj);
            this.selected_objects.splice(idx, 1);
            obj._setSelected(false);
        } else {
            this.selected_objects.push(obj);
            obj._setSelected(true);
        }
        this.selectionChanged();
    },

    /**
     * Remove selection from object
     */
    removeSelection: function (obj) {

        var idx = this.selected_objects.indexOf(obj);

        if (idx == -1 || !obj.is_selected) {
            S2uDebug.error('Trying to remove selection from unselected object');
            return;
        }

        this.selected_objects.splice(idx, 1);
        obj._setSelected(false);

        this.selectionChanged();
    },

    /**
     * Clear selection list
     */
    clearSelection: function () {

        var need_event = this.selected_objects.length > 0;

        for (idx in this.selected_objects) {
            this.selected_objects[idx]._setSelected(false);
        }

        this.selected_objects.splice(0, this.selected_objects.length);

        if (need_event) this.selectionChanged();
    },

    selectionChanged: function () {
        this._fireSelectionChanged();

        this.line_points.splice(0, this.line_points.length);
        // if selected any of line objects, then create controls to control it
        if (this.selected_objects.length == 1) {
            var obj = this.selected_objects[0];

            if (obj instanceof S2u.ModelEdge || obj instanceof S2u.ModelBus || obj instanceof S2u.ModelContour) { /* @todo add contour and bus */
                for (idx in obj.points) {
                    this.line_points.push({pos: obj.points[idx], idx: idx});
                }
            }
        }

        this.updateObjectsVisual();
    },

    // -------- input processing -----------
    onMouseMove: function (x, y) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        else return this.listener.onMouseMove(x, y);
    },

    onMouseDown: function (x, y) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        else return this.listener.onMouseDown(x, y);
    },

    onMouseUp: function (x, y) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        if (!this.pointed_object) {
            this.clearSelection();
        }
        this.focused_object = null;
        return false;
    },

    onMouseDoubleClick: function (x, y) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        else this.listener.onMouseDoubleClick(x, y);
    },

    onMouseOverObject: function (obj) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        this.pointed_object = obj;
    },

    onMouseOutObject: function (obj) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        this.pointed_object = null;
    },

    onMouseDownObject: function (obj) {
        if (this.modal != S2uModalMode.S2uModalNone) return false; // do nothing
        else this.listener.onMouseDownObject(obj);
    },

    onMouseUpObject: function (obj) {
        return this.listener.onMouseUpObject(obj);
    },

    onKeyDown: function (event) {
        if (this.modal == S2uModalMode.S2uModalNone && !$("#search-input").is(":focus")) {
            if ((event.which == KeyCode.Z) && event.ctrlKey && event.shiftKey) {
                this.commandManager.redo();
                this.updateRender();
            } else if (event.ctrlKey && (event.which == KeyCode.Z)) {
                this.commandManager.undo();
                this.updateRender();
            } else if (event.ctrlKey && (event.which == KeyCode.C)) {
                localStorage.setItem(clipS2uText, GwfFileCreate.createFileWithSelectedObject(this));
            } else if (event.ctrlKey && (event.which == KeyCode.V)) {
                if (localStorage.getItem(clipS2uText) !== null) {
                    S2uObjectBuilder.scene = this;
                    this.clearSelection();
                    GwfFileLoader.loadFromText(localStorage.getItem(clipS2uText), this.render);
                }
            } else if ((event.which == KeyCode.A) && event.ctrlKey) {
                this.selectAll();
            } else if (event.which == KeyCode.Key1) {
                this.edit.toolSelect().click()
            } else if (event.which == KeyCode.Key2) {
                this.edit.toolEdge().click()
            } else if (event.which == KeyCode.Key3) {
                this.edit.toolBus().click()
            } else if (event.which == KeyCode.Key4) {
                this.edit.toolContour().click()
            } else if (event.which == KeyCode.Key5) {
                this.edit.toolLink().click()
            } else if (event.which == KeyCode.Delete) {
                this.edit.toolDelete().click();
            } else if (event.which == KeyCode.I) {
                if (!this.edit.toolChangeIdtf().hasClass("hidden"))
                    this.edit.toolChangeIdtf().click();
            } else if (event.which == KeyCode.C) {
                if (!this.edit.toolSetContent().hasClass("hidden"))
                    this.edit.toolSetContent().click();
            } else if (event.which == KeyCode.T) {
                if (!this.edit.toolChangeType().hasClass("hidden"))
                    this.edit.toolChangeType().click();
            } else if (event.which == KeyCode.KeyMinusFirefox || event.which == KeyCode.KeyMinus ||
                event.which == KeyCode.KeyMinusNum) {
                this.edit.toolZoomOut().click();
            } else if (event.which == KeyCode.KeyEqualFirefox || event.which == KeyCode.KeyEqual ||
                event.which == KeyCode.KeyPlusNum) {
                this.edit.toolZoomIn().click();
            } else {
                this.listener.onKeyDown(event);
            }
        }
        return false;
    },

    onKeyUp: function (event) {
        if (this.modal == S2uModalMode.S2uModalNone && !$("#search-input").is(":focus")) {
            this.listener.onKeyUp(event);
        }
        return false;
    },

    // -------- edit --------------
    /**
     * Setup new edit mode for scene. Calls from user interface
     * @param {S2uEditMode} mode New edit mode
     */
    setEditMode: function (mode) {

        if (this.edit_mode == mode) return; // do nothing

        this.edit_mode = mode;
        this.listener = this.listener_array[mode];

        this.focused_object = null;
        this.edge_data.source = null;
        this.edge_data.target = null;

        this.bus_data.source = null;

        this.resetEdgeMode();
    },

    /**
     * Changes modal state of scene. Just for internal usage
     */
    setModal: function (value) {
        this.modal = value;
        this._fireModalChanged();
    },

    /**
     * Reset edge creation mode state
     */
    resetEdgeMode: function () {
        this.drag_line_points.splice(0, this.drag_line_points.length);
        this.render.updateDragLine();

        this.edge_data.source = this.edge_data.target = null;
    },

    /**
     * Revert drag line to specified point. All drag point with index >= idx will be removed
     * @param {Integer} idx Index of drag point to revert.
     */
    revertDragPoint: function (idx) {

        if (this.edit_mode != S2uEditMode.S2uModeEdge && this.edit_mode != S2uEditMode.S2uModeBus && this.edit_mode != S2uEditMode.S2uModeContour) {
            S2uDebug.error('Work with drag point in incorrect edit mode');
            return;
        }

        this.drag_line_points.splice(idx, this.drag_line_points.length - idx);

        if (this.drag_line_points.length >= 2)
            this.bus_data.end = this.drag_line_points[this.drag_line_points.length - 1];
        else
            this.bus_data.end = null;

        if (this.drag_line_points.length == 0) {
            this.edge_data.source = this.edge_data.target = null;
            this.bus_data.source = null;
        }
        this.render.updateDragLine();
    },

    /**
     * Update selected line point position
     */
    setLinePointPos: function (idx, pos) {
        if (this.selected_objects.length != 1) {
            S2uDebug.error('Invalid state. Trying to update line point position, when there are no selected objects');
            return;
        }

        var edge = this.selected_objects[0];
        if (!(edge instanceof S2u.ModelEdge) && !(edge instanceof S2u.ModelBus) && !(edge instanceof S2u.ModelContour)) {
            S2uDebug.error("Unknown type of selected object");
            return;
        }

        if (edge.points.length <= idx) {
            S2uDebug.error('Invalid index of line point');
            return;
        }
        edge.points[idx].x = pos.x;
        edge.points[idx].y = pos.y;

        edge.requestUpdate();
        edge.need_update = true;
        edge.need_observer_sync = true;

        this.updateObjectsVisual();
    },

    // ------------- events -------------
    _fireSelectionChanged: function () {
        if (this.event_selection_changed)
            this.event_selection_changed();
    },

    _fireModalChanged: function () {
        if (this.event_modal_changed)
            this.event_modal_changed();
    },

    isSelectedObjectAllArcsOrAllNodes: function () {
        var objects = this.selected_objects;
        var typeMask = objects[0].sc_type & sc_type_arc_mask ? sc_type_arc_mask :
            objects[0].sc_type & sc_type_node ?
                sc_type_node : 0;
        return (objects.every(function (obj) {
            return ((obj.sc_type & typeMask) && !(obj instanceof S2u.ModelContour) && !(obj instanceof S2u.ModelBus));
        }))
    },

    isSelectedObjectAllHaveScAddr: function () {
        return (this.selected_objects.some(function (obj) {
            return obj.sc_addr;
        }))
    }
};
