function to_cytoscape(graph){
    return graph.nodes.map(function(node){
            return {data: node};
        }).concat(graph.edges.map(function(edge){
            return {data: {id: edge.src+"-"+edge.dest,
                           source: edge.src,
                           target: edge.dest,
                           type: edge.type,
                           chg: edge.chg}};
        }));
}


function cyto_canvas(elm_id, graph, options){
    cy =  cytoscape({
        container: document.getElementById(elm_id),
        elements: to_cytoscape(graph),

        style: [ // the stylesheet for the graph
            {
                selector: 'node',
                style: {
                    'background-color': '#666666',
                    'label': 'data(name)'
                }
            },
            {
                selector: 'node[chg = "del"]',
                style: {
                    'background-color': '#ff0000',
                    'label': 'data(name)'
                }
            },
            {
                selector: 'node[chg = "add"]',
                style: {
                    'background-color': '#00ff00',
                    'label': 'data(name)'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'curve-style': 'bezier',
                    'line-color': '#666',
                    'target-arrow-color': '#666',
                    'target-arrow-shape': 'triangle'
                }
            },
            {
                selector: 'edge[chg = "add"]',
                style: {
                    'width': 3,
                    'curve-style': 'bezier',
                    'line-color': '#00ff00',
                    'target-arrow-color': '#0f0',
                    'target-arrow-shape': 'triangle'
                }
            },
            {
                selector: 'edge[chg = "del"]',
                style: {
                    'width': 3,
                    'curve-style': 'bezier',
                    'line-color': '#ff0000',
                    'target-arrow-color': '#f00',
                    'target-arrow-shape': 'triangle'
                }
            }
        ],
        autoungrabify: false,
        autolock: false
    });
    cy.layout(options)
    return cy;
}

$.getJSON("hello_diff.json", function(data){
    var options = {
        name: 'breadthfirst',

        fit: false, // whether to fit the viewport to the graph
        directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
        padding: 30, // padding on fit
        circle: false, // put depths in concentric circles if true, put depths top down if false
        spacingFactor: 0.7, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
        roots: [data.root], // the roots of the trees
        maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
        animate: true, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        ready: undefined, // callback on layoutready
        stop: undefined // callback on layoutstop
    };
    cyto_canvas('g', data, options);
});
