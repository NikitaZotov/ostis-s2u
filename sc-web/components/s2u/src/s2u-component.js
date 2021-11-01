S2uComponent = {
    ext_lang: 's2u_code',
    formats: ['format_s2u_json'],
    struct_support: true,
    factory: function (sandbox) {
        return new Promise(function (resolve, regect) {
            if (S2uKeynodesHandler.load) {
                resolve(s2uViewerWindow(sandbox));
            } else {
                S2uKeynodesHandler.initSystemKeynodes(function () {
                    resolve(s2uViewerWindow(sandbox));
                })
            }
        });
    }
};


/**
 * s2uViewerWindow
 * @constructor
 * @param sandbox
 */
var s2uViewerWindow = function (sandbox) {

    this.domContainer = sandbox.container;
    this.question_addr = sandbox.container.replace(/_format_.*/, '').replace(/.*?_(.*)/, '$1');
    console.log(sandbox)
    this.sandbox = sandbox;
    this.tree = new S2u.Tree();
    this.editor = new S2u.Editor();
    this.finder = new S2u.TemplateFinder();

    var self = this;
    if (sandbox.is_struct) {
        this.scStructTranslator = new s2uScStructTranslator(this.editor, this.sandbox);
    }

    var autocompletionVariants = function (keyword, callback, self) {

        SCWeb.core.Server.findIdentifiersSubStr(keyword, function (data) {
            keys = [];
            for (key in data) {
                var list = data[key];
                for (idx in list) {
                    var value = list[idx]
                    keys.push({name: value[1], addr: value[0], group: key});
                }
            }

            callback(keys);
        });
    };

    this.editor.init(
        {
            sandbox: sandbox,
            containerId: sandbox.container,
            autocompletionVariants: autocompletionVariants,
            translateToSc: function (scene, callback) {
                return self.scStructTranslator.translateToSc(callback);
            },
            canEdit: this.sandbox.canEdit(),
            resolveControls: this.sandbox.resolveElementsAddr,
            finder: this.finder
        }
    );

    this.finder.init({
        sandbox: sandbox,
        editor: this.editor
    });

    this.receiveData = function (data) {
        var dfd = new jQuery.Deferred();

        self.finder.contour = JSON.parse(data).keywords[0].addr;
        self.finder.drawByContour();

        dfd.resolve();
        return dfd.promise();
    };

    this.collectTriples = function (data) {

        this.triples = [];

        var elements = {};
        var edges = [];
        for (var i = 0; i < data.length; i++) {
            var el = data[i];

            elements[el.id] = el;
            if (el.el_type & sc_type_arc_mask) {
                edges.push(el);
            }
        }

        var founded = true;
        while (edges.length > 0 && founded) {
            founded = false;
            for (idx in edges) {
                var obj = edges[idx];
                var beginEl = elements[obj.begin];
                var endEl = elements[obj.end];

                // try to get begin and end object for arc
                if (beginEl && endEl) {
                    founded = true;
                    edges.splice(idx, 1);

                    this.triples.push([beginEl, {type: obj.el_type, addr: obj.id}, endEl]);
                }
            }
        }

        alert(this.triples.length);
    };

    this._buildGraph = function (data) {

        var elements = {};
        var edges = new Array();
        for (var i = 0; i < data.length; i++) {
            var el = data[i];

            if (elements.hasOwnProperty(el.id))
                continue;
            if (Object.prototype.hasOwnProperty.call(this.editor.scene.objects, el.id)) {
                elements[el.id] = this.editor.scene.objects[el.id];
                continue;
            }

            if (el.el_type & sc_type_node || el.el_type & sc_type_link) {
                var model_node = S2u.Creator.createNode(el.el_type, new S2u.Vector3(10 * Math.random(), 10 * Math.random(), 0), '');
                this.editor.scene.appendNode(model_node);
                this.editor.scene.objects[el.id] = model_node;
                model_node.setScAddr(el.id);
                model_node.setObjectState(S2uObjectState.FromMemory);
                elements[el.id] = model_node;
            } else if (el.el_type & sc_type_arc_mask) {
                edges.push(el);
            }
        }

        // create edges
        var founded = true;
        while (edges.length > 0 && founded) {
            founded = false;
            for (idx in edges) {
                var obj = edges[idx];
                var beginId = obj.begin;
                var endId = obj.end;
                // try to get begin and end object for arc
                if (elements.hasOwnProperty(beginId) && elements.hasOwnProperty(endId)) {
                    var beginNode = elements[beginId];
                    var endNode = elements[endId];
                    founded = true;
                    edges.splice(idx, 1);
                    var model_edge = S2u.Creator.createEdge(beginNode, endNode, obj.el_type);
                    this.editor.scene.appendEdge(model_edge);
                    this.editor.scene.objects[obj.id] = model_edge;
                    model_edge.setScAddr(obj.id);
                    model_edge.setObjectState(S2uObjectState.FromMemory);
                    elements[obj.id] = model_edge;
                }
            }
        }

        if (edges.length > 0)
            alert("error");

        this.editor.render.update();
        this.editor.scene.layout();
    };

    this.destroy = function () {
        delete this.editor;
        return true;
    };

    this.getObjectsToTranslate = function () {
        return this.editor.scene.getScAddrs();
    };

    this.applyTranslation = function (namesMap) {
        let self = this;
        for (addr in namesMap) {
            var obj = this.editor.scene.getObjectByScAddr(addr);
            if (obj) {
                obj.text = namesMap[addr];
                //obj.setContent(namesMap[addr]);
            }
        }
        this.editor.render.updateTexts();
        let templatesParams = self.editor.render.updateLinksMapIdf();
        Promise.all(templatesParams).then(function (data) {
            self.editor.render.updateLinksTexts();
        });
    };


    this.eventStructUpdate = function () {
        self.scStructTranslator.updateFromSc.apply(self.scStructTranslator, arguments);
    };

    // delegate event handlers
    this.sandbox.eventDataAppend = $.proxy(this.receiveData, this);
    this.sandbox.eventGetObjectsToTranslate = $.proxy(this.getObjectsToTranslate, this);
    this.sandbox.eventApplyTranslation = $.proxy(this.applyTranslation, this);
    this.sandbox.eventStructUpdate = $.proxy(this.receiveData, this);

    // find contour and draw
    new Promise(resolve => {
        SCWeb.core.Server.getAnswerTranslated(this.question_addr, this.sandbox.keynodes.format_scs_json, function (answer) {
            resolve(answer.link);
        })
    }).then(link => {
        window.sctpClient.get_link_content(link)
            .done(data => self.receiveData(data))
    });

    // subscripe component
    this.window_id = this.question_addr + '_format_' + this.sandbox.command_state.format;
    SCWeb.ui.KeyboardHandler.subscribeWindow(this.window_id, this.editor.keyboardCallbacks);
    SCWeb.ui.OpenComponentHandler.subscribeComponent(this.window_id, this.editor.openComponentCallbacks);
};

SCWeb.core.ComponentManager.appendComponentInitialize(S2uComponent);
