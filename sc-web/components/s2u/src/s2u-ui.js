// ------------------------------

S2u.Widget = function (postition, size) {
}

S2u.Widget.prototype = {
    constructor: S2u.Widget
};

/// ------------------------------
S2u.Button = function (position, size) {
    S2u.Widget.call(this, position, size);
};

S2u.Button.prototype = Object.create(S2u.Widget.prototype);


