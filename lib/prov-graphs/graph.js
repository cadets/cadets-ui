var graph1 = {
    nodes:[
        { id: 'a', type: 'proc', exe: '/bin/bash' },
        { id: 'b', type: 'file', name: 'foo.txt' },
        { id: 'c', type: 'file', name: 'bar.txt' },
        { id: 'd', type: 'file', name: 'baz.txt' },
        { id: 'e', type: 'proc', exe: '/bin/vim' }
    ],
    edges:[
        { src: 'a', dest: 'b' },
        { src: 'a', dest: 'c' },
        { src: 'd', dest: 'a' },
        { src: 'b', dest: 'e' },
        { src: 'c', dest: 'e' }
    ]
};

var graph2 = {
    nodes:[
        { id: 1, type: 'proc', exe: '/bin/bash' },
        { id: 2, type: 'file', name: 'foo.txt' },
        { id: 3, type: 'file', name: 'baz.txt' },
        { id: 4, type: 'proc', exe: '/bin/vim' }
    ],
    edges:[
        { src: 1, dest: 2 },
        { src: 3, dest: 1 },
        { src: 2, dest: 4 },
    ]
};

function to_cytoscape(graph){
    return graph.nodes.map(function(node){
            return {data: node};
        }).concat(graph.edges.map(function(edge){
            return {data: {id: edge.src+"-"+edge.dest, source: edge.src, target: edge.dest}};
        }));
}


function cyto_canvas(elm_id, graph, options){
    cy =  cytoscape({
        container: document.getElementById(elm_id),
        elements: to_cytoscape(graph),

        style: [ // the stylesheet for the graph
            {
                selector: 'node[type = "file"]',
                style: {
                    'background-color': '#00ff00',
                    'label': 'data(name)'
                }
            },
            {
                selector: 'node[type = "proc"]',
                style: {
                    'background-color': '#ff0000',
                    'label': 'data(name)'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'curve-style': 'bezier',
                    'line-color': '#ccc',
                    'target-arrow-color': '#ccc',
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

$.getJSON("hello1.json", function(data){
    var options = {
        name: 'breadthfirst',

        fit: false, // whether to fit the viewport to the graph
        directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
        padding: 30, // padding on fit
        circle: false, // put depths in concentric circles if true, put depths top down if false
        spacingFactor: 0.5, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
        roots: [20], // the roots of the trees
        maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
        animate: true, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        ready: undefined, // callback on layoutready
        stop: undefined // callback on layoutstop
    };
    cyto_canvas('g1', data, options);
});

$.getJSON("hello2.json", function(data){
    var options = {
        name: 'breadthfirst',

        fit: false, // whether to fit the viewport to the graph
        directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
        padding: 30, // padding on fit
        circle: false, // put depths in concentric circles if true, put depths top down if false
        spacingFactor: 0.7, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
        roots: [25], // the roots of the trees
        maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
        animate: true, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        ready: undefined, // callback on layoutready
        stop: undefined // callback on layoutstop
    };
    cyto_canvas('g2', data, options);
});
