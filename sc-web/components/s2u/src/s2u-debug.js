var S2uDebug = {

    enabled: true,

    error: function (message) {
        if (!this.enabled) return; // do nothing

        throw message;
    }

}
