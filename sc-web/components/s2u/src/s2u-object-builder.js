S2uObjectBuilder = {
    s2u_objects: {},
    gwf_objects: {},
    commandList: [],
    commandSetAddrList: [],
    scene: null,

    buildObjects: function (gwf_objects) {
        this.gwf_objects = gwf_objects;
        for (var gwf_object_id  in gwf_objects) {
            var gwf_object = gwf_objects[gwf_object_id];
            if (gwf_object.attributes.id in this.s2u_objects == false) {
                var s2u_object = gwf_object.buildObject({
                    scene: this.scene,
                    builder: this
                });
                this.s2u_objects[gwf_object.attributes.id] = s2u_object;
                this.commandList.push(new S2uCommandAppendObject(s2u_object, this.scene));
            }
        }
        this.scene.commandManager.execute(new S2uWrapperCommand(this.commandList), true);
        this.getScAddrsForObjects();
        this.emptyObjects();
    },

    getOrCreate: function (gwf_object_id) {
        if (gwf_object_id in this.s2u_objects == false) {
            var gwf_object = this.gwf_objects[gwf_object_id];
            this.s2u_objects[gwf_object_id] = gwf_object.buildObject({
                scene: this.scene,
                builder: this
            });
            this.commandList.push(new S2uCommandAppendObject(this.s2u_objects[gwf_object_id], this.scene));
        }
        return this.s2u_objects[gwf_object_id];
    },

    getScAddrsForObjects: function () {
        var self = this;
        var nodes = this.getAllNodesFromObjects();
        var promises = this.trySetScAddrForNodes(nodes);
        Promise.all(promises).then(function () {
            self.scene.commandManager.execute(new S2uWrapperCommand(self.commandSetAddrList));
            self.commandSetAddrList = [];
        });
    },

    getAllNodesFromObjects: function () {
        var self = this;
        var nodes = [];
        Object.keys(this.s2u_objects).forEach(function (gwf_object_id) {
            var node = self.s2u_objects[gwf_object_id];
            if (node instanceof S2u.ModelNode) {
                nodes.push(node);
            }
        });
        return nodes;
    },

    trySetScAddrForNodes: function (nodes) {
        var self = this;
        var edit = this.scene.edit;
        var promises = [];
        nodes.forEach(function (node) {
            promises.push(new Promise(function (resolve) {
                var idtf = node.text;
                if (idtf != null) {
                    edit.autocompletionVariants(idtf, function (keys) {
                        var notFindIdtf = true;
                        for (var key = 0; key < keys.length; key++) {
                            if (keys[key].name == idtf && keys[key].addr != null) {
                                notFindIdtf = false;
                                var addr = keys[key].addr;
                                self.commandSetAddrList.push(new S2uCommandGetNodeFromMemory(
                                    node,
                                    node.sc_type,
                                    idtf,
                                    addr,
                                    self.scene)
                                );
                                resolve(node);
                                break;
                            }
                        }
                        if (notFindIdtf) {
                            resolve(node);
                        }
                    });
                } else {
                    resolve(node);
                }
            }));
        });
        return promises;
    },

    emptyObjects: function () {
        this.gwf_objects = {};
        this.s2u_objects = {};
        this.commandList = [];
    }
};