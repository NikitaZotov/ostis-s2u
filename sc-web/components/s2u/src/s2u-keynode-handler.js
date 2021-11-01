S2uKeynodesHandler = {

    systemKeynodes: [
        'nrel_position_x',
        'nrel_position_y',
        'element_class_image',
        'connector_class_image',
        'nrel_html_template',
        'nrel_incidence'
    ],

    scKeynodes: {},

    load: false,

    initSystemKeynodes: function (callback, keynodes) {
        let self = this;

        keynodes || (keynodes  = self.systemKeynodes);
        SCWeb.core.Server.resolveScAddr(keynodes, function (keynodes) {
            Object.getOwnPropertyNames(keynodes).forEach(function (key) {
                S2uLogger.logDebug(`Resolved keynode: ${key} = ${keynodes[key]}`);
                self.scKeynodes[key] = keynodes[key];
            });
            self.load = true;
            callback();
        });
    }
};
