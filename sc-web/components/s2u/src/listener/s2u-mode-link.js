S2uLinkListener = function (scene) {
    this.scene = scene;
};

S2uLinkListener.prototype = {

    constructor: S2uLinkListener,

    onMouseMove: function (x, y) {
        return false;
    },

    onMouseDown: function (x, y) {
        return false;
    },

    onMouseDoubleClick: function (x, y) {
        if (this.scene.pointed_object && !(this.scene.pointed_object instanceof S2u.ModelContour)) {
            return false;
        }
        this.scene.commandManager.execute(new S2uCommandCreateLink(x, y, this.scene));
        return true;
    },

    onMouseDownObject: function (obj) {
        return false;
    },

    onMouseUpObject: function (obj) {
        return true;
    },

    onKeyDown: function (event) {
        return false;
    },

    onKeyUp: function (event) {
        return false;
    }

};