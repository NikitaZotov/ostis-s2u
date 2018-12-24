S2uCommandChangeType = function (object, newType) {
    this.object = object;
    this.oldType = object.sc_type;
    this.newType = newType;
};

S2uCommandChangeType.prototype = {

    constructor: S2uCommandChangeType,

    undo: function () {
        this.object.setScType(this.oldType);
    },

    execute: function () {
        this.object.setScType(this.newType);
    }

};
