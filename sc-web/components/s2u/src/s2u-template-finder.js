S2u.TemplateFinder = function () {

    this.contour = null;
    this.editor = null;
    this.scene = null;
    this.render = null;
    this.templates = [];
};

let testPos;

S2u.TemplateFinder.prototype = {


    init: function (params) {

        this.contour = params.contour;
        this.editor = params.scene;
        this.scene = params.editor.scene;
        this.render = params.editor.render;
        this.sandbox = params.sandbox;
    },

    drawByContour: function () {

        testPos = this;

        console.log(`S2U: draw contour ${this.contour}`);

        let self = this;
        let promiseObject = S2uObjectsHandler.addAllObjectsByContour(self.contour);
        promiseObject.then(objects => {
            self.getObjectsInContour(objects)
        })
    },

    getObjectsInContour: function (objects) {

        function getRandomInt0to100() {
            return Math.floor(Math.random() * (1000));
        }

        console.log(`S2U: get objects in contour ${this.contour}`);
        let self = this;

        let elements = objects[S2uObjectsHandler.ELEMENTS_CONST];
        let connectors = objects[S2uObjectsHandler.CONNECTORS_CONST];
        console.log(elements);
        console.log(connectors);

        let elementsPromise = elements.map((element) => {
            return self.getElements(element)
        });

        Promise.all(elementsPromise).then((array) => {
            console.log(`S2U: get elements`);
            console.log(array);
            let templatesParams = [];

            array.forEach(elements => {
                elements.forEach(element => {
                    let template = S2uObjectsHandler.getElementTemplateForObject(element);
                    let link = S2u.Creator.createLink(new S2u.Vector3(getRandomInt0to100(), getRandomInt0to100(), 0), '');
                    link.sc_addr = element;
                    self.scene.appendLink(link);
                    let templateParamsPromise = self.loadTemplateParams(template,link);
                    templatesParams.push(templateParamsPromise)
                });
            });

            let connectorsPromise = connectors.map((element) => {
                return self.getConnectors(element)
            });

            Promise.all(connectorsPromise).then((array) => {
                console.log(`S2U: get connectors`);
                console.log(array);
                array.forEach(elements => {
                    elements.forEach(model => {
                        let object = self.findSourceAndTargetByModel(model);
                        if (object.target && object.source) {
                            let edge = S2u.Creator.createEdge(object.source, object.target, sc_type_arc_pos_const_perm);
                            self.scene.appendObject(edge);
                            edge.sc_addr = model.node;
                        } else {
                            console.log(`S2U: Error, can not create arrow ${model.source} -> ${model.target} for ${model.node}`);
                        }
                    });
                });

                Promise.all(templatesParams).then(function (data) {
                    self.setPositionForAllElemets();
                });
            });
        });
    },

    getElements: function (element) {
        let self = this;
        return new Promise((resolve, reject) => {
            window.sctpClient.iterate_constr(
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                    [
                        element,
                        sc_type_arc_pos_const_perm,
                        sc_type_node | sc_type_const,
                        sc_type_arc_pos_const_perm,
                        parseInt(self.contour)
                    ],
                    {"node": 2}
                )
            ).done(function (results) {

                let arrayAddr = [];

                for (let template = 0; template < results.results.length; template++) {
                    let addr = results.get(template, "node");
                    arrayAddr.push(addr);
                }

                arrayAddr = arrayAddr.filter((v, i, a) => a.indexOf(v) === i);

                arrayAddr.forEach((addr) => {
                    console.log(`S2U: find ${element} - ${addr}`);
                    if (!S2uObjectsHandler.objectsElementMap[addr]) {
                        S2uObjectsHandler.objectsElementMap[addr] = element;
                    } else {
                        if (S2uObjectsHandler.objectsElementMap[addr] !== element) {
                            throw  `S2uObjectsHandler.objectsElementMap[${addr}] = ${S2uObjectsHandler.objectsElementMap[addr]} but need set ${element}`
                        }
                    }
                });

                resolve(arrayAddr)
            }).fail(function () {
                console.log(`S2U: nothing find for element - ${element}`);
                let returnData =  [];
                resolve(returnData);
            });
        });
    },

    getConnectors: function (element) {
        let self = this;
        return new Promise((resolve, reject) => {
            window.sctpClient.iterate_constr(
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                    [
                        element,
                        sc_type_arc_pos_const_perm,
                        sc_type_node | sc_type_const,
                        sc_type_arc_pos_const_perm,
                        parseInt(self.contour)
                    ],
                    {"node": 2}
                ),
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5A_A_F_A_F,
                    [
                        sc_type_node | sc_type_const,
                        sc_type_arc_common | sc_type_const,
                        "node",
                        sc_type_arc_pos_const_perm,
                        parseInt(self.contour)
                    ],
                    {"source": 0, "source_arc": 1}
                ),
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                    [
                        "node",
                        sc_type_arc_common | sc_type_const,
                        sc_type_node | sc_type_const,
                        sc_type_arc_pos_const_perm,
                        parseInt(self.contour)
                    ],
                    {"target_arc": 1, "target": 2}
                ),
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                    [
                        S2uKeynodesHandler.scKeynodes.nrel_incidence,
                        sc_type_arc_pos_const_perm,
                        "source_arc"
                    ]
                ),
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                    [
                        S2uKeynodesHandler.scKeynodes.nrel_incidence,
                        sc_type_arc_pos_const_perm,
                        "target_arc"
                    ]
                )
            ).done(function (results) {

                let arrayAddr = [];

                for (let template = 0; template < results.results.length; template++) {
                    let addr = results.get(template, "node");
                    let source = results.get(template, "source");
                    let target = results.get(template, "target");
                    arrayAddr.push({
                        node: addr,
                        source: source,
                        target: target
                    });
                }

                arrayAddr.forEach((model) => {
                    console.log(`S2U: find ${element} - ${model.source} => ${model.node} => ${model.target}`);
                    if (!S2uObjectsHandler.objectsConnectorMap[model.node]) {
                        S2uObjectsHandler.objectsConnectorMap[model.node] = element;
                    } else {
                        if (S2uObjectsHandler.objectsConnectorMap[model.node] !== element) {
                            throw  `S2uObjectsHandler.objectsConnectorMap[${model.node}] = ${S2uObjectsHandler.objectsConnectorMap[model.node]} but need set ${element}`
                        }
                    }
                });

                resolve(arrayAddr)
            }).fail(function () {
                console.log(`S2U: nothing find for connector - ${element}`);
                let returnData =  [];
                resolve(returnData);
            });
        });
    },

    loadTemplateParams: function (template,link) {
        let currentLanguage = this.sandbox.getCurrentLanguage();
        return new Promise((resolve, reject) => {
            let array = S2uObjectsHandler.getMatches(template, S2uObjectsHandler.TEMPLATE_REGEX);
            let promisesGetParams = array.map((idf) => {
                return new Promise((resolveIdf, rejectIdf) => {
                    window.sctpClient.iterate_constr(
                        SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                            [
                                parseInt(link.sc_addr),
                                sc_type_arc_common | sc_type_const,
                                sc_type_link,
                                sc_type_arc_pos_const_perm,
                                S2uKeynodesHandler.scKeynodes[idf]
                            ],
                            {"idf": 2}
                        ),
                        SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                            [
                                parseInt(currentLanguage),
                                sc_type_arc_pos_const_perm,
                                "idf"
                            ]
                        )
                    ).done(function (results) {
                        let html = results.get(0, "idf");

                        window.sctpClient.get_link_content(html).done(string => {
                            console.log (`S2U: find for ${link.sc_addr} by ${idf}: ${string}`);
                            link.mapIdf[idf] = string;
                            resolveIdf(string);
                        });
                    }).fail(function () {
                        console.log(`S2U: nothing find for ${link.sc_addr} by ${idf}`);
                        link.mapIdf[idf] = "null";
                        resolveIdf("null");
                    });
                });
            });

            Promise.all(promisesGetParams).then(function (data) {
                resolve(data);
            });
        });
    },

    findSourceAndTargetByModel: function (model) {

        let source;
        let target;

        source = this.scene.links.find(function (item) {
            return item.sc_addr === model.source;
        });

        target = this.scene.links.find(function (item) {
            return item.sc_addr === model.target;
        });

        return {
            source: source,
            target: target
        }
    },

    setPositionForAllElemets: function () {
        let self = this;
        let needAutoLayout = false;
        let elements = this.scene.links;
        let positions = elements.map(element => {
            return new Promise((resolve, reject) => {
                window.sctpClient.iterate_constr(
                    SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                        [
                            parseInt(element.sc_addr),
                            sc_type_arc_common | sc_type_const,
                            sc_type_link,
                            sc_type_arc_pos_const_perm,
                            S2uKeynodesHandler.scKeynodes.nrel_position_x
                        ],
                        {"nrel_position_x": 2}
                    ),
                    SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                        [
                            parseInt(element.sc_addr),
                            sc_type_arc_common | sc_type_const,
                            sc_type_link,
                            sc_type_arc_pos_const_perm,
                            S2uKeynodesHandler.scKeynodes.nrel_position_y
                        ],
                        {"nrel_position_y": 2}
                    ),
                    SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                        [
                            parseInt(self.contour),
                            sc_type_arc_pos_const_perm,
                            "nrel_position_x"
                        ]
                    ),
                    SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                        [
                            parseInt(self.contour),
                            sc_type_arc_pos_const_perm,
                            "nrel_position_y"
                        ]
                    )
                ).done(function (results) {
                    let nrel_position_x = results.get(0, "nrel_position_x");
                    let nrel_position_y = results.get(0, "nrel_position_y");

                    window.sctpClient.get_link_content(nrel_position_x).done(x_string => {
                        window.sctpClient.get_link_content(nrel_position_y).done(y_string => {
                            let position = new S2u.Vector3(parseFloat(x_string), parseFloat(y_string), 0.0)
                            element.setPosition(position);
                            resolve(position);
                        });
                    });
                }).fail(function () {
                    console.log(`S2U: nothing find position for ${element.sc_addr}`);
                    needAutoLayout = true;
                    resolve(element.position);
                });
            })
        });

        Promise.all(positions).then(function (data) {
            if (needAutoLayout) {
                self.scene.layout();
            }
            self.render.update();
        });
    }

};
