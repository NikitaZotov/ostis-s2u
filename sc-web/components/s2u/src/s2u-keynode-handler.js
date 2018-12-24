S2uKeynodesHandler = {

    systemIds: [
        'nrel_position_x',
        'nrel_position_y',
        'element_class_image',
        'connector_class_image',
        'nrel_html_template',
        'nrel_incidence'
    ],

    scKeynodes: {},

    load: false,

    initSystemIds: function (callback, ids) {
        ids || (ids = this.systemIds);
        var self = this;
        SCWeb.core.Server.resolveScAddr(ids, function (keynodes) {
            Object.getOwnPropertyNames(keynodes).forEach(function (key) {
                console.log('S2U: Resolved keynode: ' + key + ' = ' + keynodes[key]);
                self.scKeynodes[key] = keynodes[key];
            });
            self.load = true;
            callback();
        });
    }

};
