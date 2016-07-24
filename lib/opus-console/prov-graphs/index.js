/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var cs = require('cytoscape');
var ph_sp = require('phosphor-splitpanel');
var pw = require('phosphor-widget');
var cd_app = {};

exports.provGraphExtension = {
    id: 'cadets.prov.graph',
    activate: activateProvGraph,
    addGraph: addProvGraph,
    aboutpanel: {},
    opened: {}
};
function activateProvGraph(app) {
    cd_app = app;

    var panel = new ph_sp.SplitPanel();
    panel.orientation = ph_sp.SplitPanel.Horizontal;
    panel.id = 'opus-header';

    var logo = new pw.Widget();
    logo.id = 'logo';
    logo.title.text = 'cadets-logo';
    logo.addClass('cadets-logo');

    var graph = createAboutPanel();
    exports.provGraphExtension.aboutpanel = graph

    panel.addChild(logo);
    panel.addChild(graph);

    app.shell.addToMainArea(graph);
    return Promise.resolve();
}

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
    cy =  cs.cytoscape({
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
        autoungrabify: true,
        autolock: false
    });
    cy.layout(options)
    return cy;
}

function addProvGraph(node) {
  var graph = new pw.Widget();
  graph.id = 'graph-'+node.original.gnode_id
  var bin = node.original.binary.split('/').reverse()[0]
  graph.title.text = "["+ node.original.pid +"] "+bin
  graph.title.closable = true;
  graph.addClass("p-graph-container");

  let div = document.createElement('div');
  div.className +="provgraph"
  div.id = 'g-'+node.original.gnode_id;
  graph.node.appendChild(div);

  $.ajax({url: "../provgraph?gnode_id="+node.original.gnode_id,
          type: "GET",
          async: true,
          success: function(data){
              data = $.parseJSON(data)
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
              cyto_canvas('g-'+node.original.gnode_id, data, options);
          }});


  cd_app.shell.addToMainArea(graph)
}

function createAboutPanel() {
    var widget = new pw.Widget();
    widget.id = 'proctree';
    widget.title.text = 'About Demo';
    widget.title.closable = true;
    widget.addClass('no-content');
    return widget;
}
