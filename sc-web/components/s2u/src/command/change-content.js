S2uCommandChangeContent = function (object, newContent, newType, newFileReaderResult) {
    this.object = object;
    this.oldContent = object.content;
    this.newContent = newContent;
    this.oldType = object.contentType;
    this.newType = newType;
    this.oldFileReaderResult = object.fileReaderResult;
    this.newFileReaderResult = newFileReaderResult;
};

S2uCommandChangeContent.prototype = {

    constructor: S2uCommandChangeContent,

    undo: function () {
        this.object.setContent(this.oldContent, this.oldType);
        this.object.fileReaderResult = this.oldFileReaderResult;
    },

    execute: function () {
        this.object.setContent(this.newContent, this.newType);
        this.object.fileReaderResult = this.newFileReaderResult;
    }

};
