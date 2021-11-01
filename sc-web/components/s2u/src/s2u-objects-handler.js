S2uObjectsHandler = {

    nodes: {},

    NODES_CONST: "elements",

    connectors: {},

    CONNECTORS_CONST: "connectors",

    objectsNodesMap: {},

    objectsConnectorMap: {},

    TEMPLATE_REGEX: /#{(.*?)}/g,

    DEFAULT_ELEMENT:
        '<rect class="S2UBorderRect" x="0" y="0" style="fill: none; fill-opacity:0" width="0" height="0"/> ' +
        '<circle cx="10" cy="10" r="10" stroke="black" stroke-width="3" fill="red"/>',

    DEFAULT_CONNECTOR:
        '<path stroke="black" stroke-width="3" fill="none" d="${position_path}" ></path>',

    addAllObjectsByContour: function (contour) {
        let self = this;
        return new Promise(function (resolve, reject) {
            let promiseElement = self.addAllObjectsByContourParam(
                contour, self.NODES_CONST, S2uKeynodesHandler.scKeynodes.element_class_image
            );
            let promiseConnector = self.addAllObjectsByContourParam(
                contour, self.CONNECTORS_CONST, S2uKeynodesHandler.scKeynodes.connector_class_image
            );

            Promise.all([promiseElement, promiseConnector]).then(function (data) {
                S2uLogger.logDebug(`Reload UI for contour ${contour}`);
                let reloadableElements = [];

                Object.keys(self.nodes)
                    .filter(el => !self.nodes[el])
                    .forEach(el => reloadableElements.push(el));
                Object.keys(self.connectors)
                    .filter(el => !self.connectors[el])
                    .forEach(el => reloadableElements.push(el));

                let promiseReloadUi = self.loadUi(reloadableElements);
                promiseReloadUi.then((done) => {
                    let returnData = Object.assign(data[0], data[1]);
                    resolve(returnData)
                })
            });
        });
    },

    addAllObjectsByContourParam: function (contour, type, classAddr) {
        if (type !== this.NODES_CONST && type !== this.CONNECTORS_CONST) {
            throw `S2U: error type: ${type}`
        }

        S2uLogger.logDebug(`Add all ${type} in contour ${contour}`);

        let self = this;

        return new Promise(function (resolve, reject) {
            window.sctpClient.iterate_constr(
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_A,
                    [
                        classAddr,
                        sc_type_arc_pos_const_perm,
                        sc_type_node | sc_type_const
                    ],
                    {"node": 2}
                ),
                SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_3F_A_F,
                    [
                        parseInt(contour),
                        sc_type_arc_pos_const_perm,
                        "node"
                    ]
                )
            ).done(function (results) {
                if (results.results.length === 0) {
                    S2uLogger.logError(`Elements not found`)
                }

                let arrayAddr = [];

                for (let template = 0; template < results.results.length; template++) {
                    let addr = results.get(template, "node");
                    arrayAddr.push(addr);
                }

                arrayAddr = arrayAddr.filter((v, i, a) => a.indexOf(v) === i);

                arrayAddr.forEach((addr) => {
                    S2uLogger.logDebug(`Found ${type} ${addr} for contour ${contour}`);

                    let object = (type === self.NODES_CONST) ? self.nodes : self.connectors;
                    if (object[addr]) {
                        S2uLogger.logDebug(`Found ${type} ${addr} already exists`);
                    } else {
                        S2uLogger.logDebug(`Found ${type} ${addr} add`);
                        object[addr] = null;
                    }
                });

                let returnData = {};
                returnData[type] = arrayAddr;

                resolve(returnData)
            }).fail(function () {
                S2uLogger.logError(`Nothing found ${type} for contour ${contour}`);
                let returnData = {};
                returnData[type] = [];
                resolve(returnData);
            });
        });
    },

    loadUi: function(array) {
        let self = this;
        return new Promise(function (resolve, reject) {
            let elementsIterator = array.map((el) => {
                return new Promise(function (resolveElement, rejectElement) {
                    S2uLogger.logDebug(`Found template text for ${el} `);

                    window.sctpClient.iterate_constr(
                        SctpConstrIter(SctpIteratorType.SCTP_ITERATOR_5F_A_A_A_F,
                            [
                                parseInt(el),
                                sc_type_arc_common | sc_type_const,
                                sc_type_link,
                                sc_type_arc_pos_const_perm,
                                S2uKeynodesHandler.scKeynodes.nrel_html_template
                            ],
                            {"html": 2}
                        )
                    ).done(function (results) {
                        let html = results.get(0, "html");

                        window.sctpClient.get_link_content(html).done(htmlString => {
                            S2uLogger.logDebug(`Html string for ${el} - ${htmlString}`)
                            if (self.nodes[el] === null) {
                                self.nodes[el] = htmlString;
                            } else if (self.connectors[el] === null) {
                                self.connectors[el] = htmlString;
                            }
                            resolveElement(htmlString);
                        });
                    }).fail(function () {
                        S2uLogger.logDebug(`Not found template for ${el}`);
                        let htmlString = null;

                        if (self.nodes[el] !== null) {
                            htmlString = self.DEFAULT_ELEMENT;
                        } else {
                            htmlString = self.DEFAULT_CONNECTOR;
                        }
                        resolveElement(htmlString);
                    });
                });
            });

            Promise.all(elementsIterator).then(function (data) {
                let keynodes = [];

                data.forEach((template) => {
                    keynodes = keynodes.concat(self.getMatches(template, self.TEMPLATE_REGEX));
                });

                keynodes = keynodes.filter((v, i, a) => a.indexOf(v) === i);
                keynodes = keynodes.filter((v, i, a) => !S2uKeynodesHandler.scKeynodes.hasOwnProperty(v));
                S2uLogger.logDebug(`Keynodes initiated: ${keynodes.toString()}`);
                S2uKeynodesHandler.initSystemKeynodes(() => resolve(data), keynodes);
            });
        });
    },

    getMatches: function(string, regex, index) {
        index || (index = 1);
        let matches = [];
        let match;

        while (match = regex.exec(string)) {
            matches.push(match[index]);
        }

        return matches;
    },

    getElementTemplateForObject: function(addr) {
        if (!addr) {
            return this.DEFAULT_ELEMENT;
        }

        return this.nodes[this.objectsNodesMap[addr]];
    },

    getConnectorTemplateForObject: function(addr) {
        if (!addr) {
            return this.DEFAULT_CONNECTOR;
        }
        return this.connectors[this.objectsConnectorMap[addr]];
    }
};
