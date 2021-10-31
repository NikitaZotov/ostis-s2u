var S2uLogger = {

    error: true,
    debug: true,
    info: true,

    logError: function (message) {
        if (!this.error)
            return;

        console.log(`S2u: Error: ${message}`);
    },

    logDebug: function (message) {
        if (!this.debug)
            return;

        console.log(`S2u: Debug: ${message}`);
    },

    logInfo: function (message) {
        if (!this.info)
            return;

        console.log(`S2u: Info: ${message}`);
    }
}
