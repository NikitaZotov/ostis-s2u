S2uWrapperCommand = function (commands) {
    this.commands = commands;
};

S2uWrapperCommand.prototype = {

    constructor: S2uWrapperCommand,

    undo: function () {
        this.commands.forEach(function (command) {
            command.undo();
        });
    },

    execute: function () {
        this.commands.forEach(function (command) {
            command.execute();
        });
    }

};
