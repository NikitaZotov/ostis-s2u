S2uObjectsHandler = {

    elements: {},

    ELEMENTS_CONST: "elements",

    connectors: {},

    CONNECTORS_CONST: "connectors",

    objectsElementMap: {},

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
                contour, self.ELEMENTS_CONST, S2uKeynodesHandler.scKeynodes.element_class_image
            );
            let promiseConnector = self.addAllObjectsByContourParam(
                contour, self.CONNECTORS_CONST, S2uKeynodesHandler.scKeynodes.connector_class_image
            );
            Promise.all([promiseElement, promiseConnector]).then(function (data) {
                console.log(`S2U: reload UI for contour ${contour}`);
                let forReloadUI = [];
                Object.keys(self.elements)
                    .filter(el => !self.elements[el])
                    .forEach(el => forReloadUI.push(el));
                Object.keys(self.connectors)
                    .filter(el => !self.connectors[el])
                    .forEach(el => forReloadUI.push(el));
                let promiseReloadUi = self.loadUi(forReloadUI);
                promiseReloadUi.then((done) => {
                    let returnData = Object.assign(data[0], data[1]);
                    resolve(returnData)
                })
            });
        });
    },

    addAllObjectsByContourParam: function (contour, type, classAddr) {

        if (type !== this.ELEMENTS_CONST && type !== this.CONNECTORS_CONST) {
            throw `S2U: error type: ${type}`
        }

        console.log(`S2U: add all ${type} in contour ${contour}`);

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

                let arrayAddr = [];

                for (let template = 0; template < results.results.length; template++) {
                    let addr = results.get(template, "node");
                    arrayAddr.push(addr);
                }

                arrayAddr = arrayAddr.filter((v, i, a) => a.indexOf(v) === i);

                arrayAddr.forEach((addr) => {
                    console.log(`S2U: find ${type} ${addr} for contour ${contour}`);

                    let object = (type === self.ELEMENTS_CONST) ? self.elements : self.connectors;
                    if (object[addr]) {
                        console.log(`S2U: find ${type} ${addr} already exist`);
                    } else {
                        console.log(`S2U: find ${type} ${addr} add`);
                        object[addr] = null;
                    }
                });

                let returnData = {};
                returnData[type] = arrayAddr;

                resolve(returnData)
            }).fail(function () {
                console.log(`S2U: nothing find ${type} for contour ${contour}`);
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
                    console.log(`S2U: find template text for ${el} `);

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
                            console.log (`S2U: html string for ${el} - ${htmlString}`)
                            if (self.elements[el] === null) {
                                self.elements[el] = htmlString
                            } else if (self.connectors[el] === null) {
                                self.connectors[el] = htmlString
                            }
                            resolveElement(htmlString)
                        });
                    }).fail(function () {
                        console.log(`S2U: not find template for ${el}`);

                        if (self.elements[el] === null) {
                            self.elements[el] = self.DEFAULT_ELEMENT;
                        } else if (self.connectors[el] === null) {
                            self.connectors[el] = self.DEFAULT_CONNECTOR;
                        }
                        resolveElement(htmlString)
                    });
                });
            });

            Promise.all(elementsIterator).then(function (data) {

                let ids = [];
                data.forEach((template) => {
                    ids = ids.concat(self.getMatches(template, self.TEMPLATE_REGEX));
                });
                ids = ids.filter((v, i, a) => a.indexOf(v) === i);
                ids = ids.filter((v, i, a) => !S2uKeynodesHandler.scKeynodes.hasOwnProperty(v));
                console.log(`S2U: add ids: ${ids.toString()}`);
                S2uKeynodesHandler.initSystemIds(() => resolve(data), ids);
            });
        });
    },

    getMatches: function(string, regex, index) {
        index || (index = 1); // default to the first capturing group
        let matches = [];
        let match;
        while (match = regex.exec(string)) {
            matches.push(match[index]);
        }
        return matches;
    },

    getElementTemplateForObject: function(addr){
        if (!addr){
            return this.DEFAULT_ELEMENT
        }
        return this.elements[this.objectsElementMap[addr]]
    },

    getConnectorTemplateForObject: function(addr){
        if (!addr){
            return this.DEFAULT_CONNECTOR
        }
        return this.connectors[this.objectsConnectorMap[addr]]
    }

};
