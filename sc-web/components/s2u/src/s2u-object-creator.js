S2u.Creator = {};

/**
 * Create new node
 * @param {Integer} sc_type Type of node
 * @param {S2u.Vector3} pos Position of node
 * @param {String} text Text assotiated with node
 *
 * @return S2u.ModelNode created node
 */
S2u.Creator.createNode = function (sc_type, pos, text) {
    return new S2u.ModelNode({
        position: pos.clone(),
        scale: new S2u.Vector2(20, 20),
        sc_type: sc_type,
        text: text
    });
};

S2u.Creator.createLink = function (pos, containerId) {
    var link = new S2u.ModelLink({
        position: pos.clone(),
        scale: new S2u.Vector2(50, 50),
        sc_type: sc_type_link,
        containerId: containerId
    });
    link.setContent("");
    return link;
};

/**
 * Create edge between two specified objects
 * @param {S2u.ModelObject} source Edge source object
 * @param {S2u.ModelObject} target Edge target object
 * @param {Integer} sc_type SC-type of edge
 *
 * @return S2u.ModelEdge created edge
 */
S2u.Creator.createEdge = function (source, target, sc_type) {
    return new S2u.ModelEdge({
        source: source,
        target: target,
        sc_type: sc_type ? sc_type : sc_type_edge_common
    });
};

S2u.Creator.createBus = function (source) {
    return new S2u.ModelBus({
        source: source
    });
};

S2u.Creator.createCounter = function (polygon) {
    return new S2u.ModelContour({
        verticies: polygon
    });
};
