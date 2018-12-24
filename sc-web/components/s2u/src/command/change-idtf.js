S2uCommandChangeIdtf = function (object, newIdtf) {
    this.object = object;
    this.oldIdtf = object.text;
    this.newIdtf = newIdtf;
};

S2uCommandChangeIdtf.prototype = {

    constructor: S2uCommandChangeIdtf,

    undo: function () {
        this.object.setText(this.oldIdtf);
    },

    execute: function () {
        this.object.setText(this.newIdtf);
    }

};
