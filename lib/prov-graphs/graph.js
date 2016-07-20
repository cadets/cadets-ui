var cy = cytoscape({
    container: document.getElementById('graph'),
    elements: [ // list of graph elements to start with
        { // node a
            data: { id: 'a', type: 'proc', exe: '/bin/bash' }
        },
        { // node b
            data: { id: 'b', type: 'file', name: 'foo.txt' }
        },
        {
            data: { id: 'c', type: 'file', name: 'bar.txt' }
        },
        {
            data: { id: 'd', type: 'file', name: 'baz.txt' }
        },
        {
            data: { id: 'e', type: 'proc', exe: '/bin/vim' }
        },
        { // edge ab
            data: { id: 'ab', source: 'a', target: 'b' }
        },
        {
            data: { id: 'ac', source: 'a', target: 'c' }
        },
        {
            data: { id: 'da', source: 'd', target: 'a' }
        },
        {
            data: { id: 'be', source: 'b', target: 'e' }
        },
        {
            data: { id: 'ce', source: 'c', target: 'e' }
        },
        {
            data: { id: 'de', source: 'd', target: 'e' }
        },
    ],

    style: [ // the stylesheet for the graph
        {
            selector: 'node[type = "file"]',
            style: {
                'background-color': '#060',
                'label': 'data(name)'
            }
        },
        {
            selector: 'node[type = "proc"]',
            style: {
                'background-color': '#600',
                'label': 'data(exe)'
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

    layout: {
        name: 'breadthfirst',

        fit: true, // whether to fit the viewport to the graph
        directed: true, // whether the tree is directed downwards (or edges can point in any direction if false)
        padding: 30, // padding on fit
        circle: false, // put depths in concentric circles if true, put depths top down if false
        spacingFactor: 1.75, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
        roots: undefined, // the roots of the trees
        maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
        animate: false, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        ready: undefined, // callback on layoutready
        stop: undefined // callback on layoutstop
    },
    autoungrabify: true,
});
