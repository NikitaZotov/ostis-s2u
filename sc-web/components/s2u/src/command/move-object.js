S2uCommandMoveObject = function (object, offset) {
    this.object = object;
    this.offset = offset;
};

S2uCommandMoveObject.prototype = {

    constructor: S2uCommandMoveObject,

    undo: function () {
        this.object.setPosition(this.object.position.clone().add(this.offset));
    },

    execute: function () {
        this.object.setPosition(this.object.position.clone().sub(this.offset));
    }

};
