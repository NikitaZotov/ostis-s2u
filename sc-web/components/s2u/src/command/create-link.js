S2uCommandCreateLink = function (x, y, scene) {
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.link = null;
};

S2uCommandCreateLink.prototype = {

    constructor: S2uCommandCreateLink,

    undo: function () {
        if (this.link.is_selected) {
            var idx = this.scene.selected_objects.indexOf(this.link);
            this.scene.selected_objects.splice(idx, 1);
            this.link._setSelected(false);
            this.scene.edit.onSelectionChanged();
        }
        this.scene.removeObject(this.link);
    },

    execute: function () {
        if (this.link == null) {
            this.link = S2u.Creator.createLink(new S2u.Vector3(this.x, this.y, 0), '');
            this.scene.appendLink(this.link);
            this.scene.updateRender();
            this.scene.clearSelection();
            this.scene.appendSelection(this.link);
        } else {
            this.scene.appendLink(this.link);
            this.link.update();
        }
    }

};
