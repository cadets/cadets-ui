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

var cytoscape = require('cytoscape');
var ph_sp = require('phosphor-splitpanel');
var pw = require('phosphor-widget');
var menu = require('_/opus-console/header/index').headerExtension
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

    var graph = createAboutPanel();
    exports.provGraphExtension.aboutpanel = graph
    app.shell.addToMainArea(graph);

    return Promise.resolve();
}

function to_cytoscape(graph){
    return graph.nodes.map(function(node){
            return {group: 'nodes', data: node};
        }).concat(graph.edges.map(function(edge){
            return {group: 'edges', data: {id: edge.src+"-"+edge.dest,
                           source: edge.src,
                           target: edge.dest,
                           type: edge.type,
                           chg: edge.chg}};
        }));
}

function addProvGraph(node) {
  $.ajax({url: "../provgraph?gnode_id="+node.original.gnode_id,
          type: "GET",
          async: true,
          success: function(data){
              data = $.parseJSON(data)
              var options = {
                  name: 'breadthfirst',

                  fit: true, // whether to fit the viewport to the graph
                  directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
                  padding: 30, // padding on fit
                  circle: false, // put depths in concentric circles if true, put depths top down if false
                  spacingFactor: 1, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
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
              var id = 'gr-'+node.original.gnode_id
              var graph = new GraphWidget(data, options, id);
              graph.id = id;
              var bin = node.original.binary.split('/').reverse()[0]
              graph.title.text = "["+ node.original.pid +"] "+bin
              graph.title.closable = true;
              menu.diffAdd(node.original.gnode_id);
              cd_app.shell.addToMainArea(graph)
          }});
}

var GraphWidget = (function (_super) {
  __extends(GraphWidget, _super);
  function GraphWidget(graph, cylayout, id, style) {
    _super.call(this);
    this.addClass('provgraph');
    this._cylayout = cylayout;
    this._cyid = id;
    this._graph = to_cytoscape(graph);
    if(style === undefined) {
      style = [ // the stylesheet for the graph
            {
                selector: 'node',
                style: {
                    'font-size': 'large',
                    'label': 'data(name)',
                    'background-fit': 'cover',
                    'background-height': '100%',
                    'background-width': '100%',
                    'background-opacity': 0,
                }
            },
            {
                selector: 'node[type = "file"]',
                style: {
                    'background-image': '/static/img/file.png',
               }
            },
            {
                selector: 'node[type = "proc"]',
                style: {
                    'background-image': '/static/img/proc.png',
                }
            },
            {
                selector: 'node[name = "/usr/lib/crt1.o"]',
                style: {
                    'overlay-color': '#f00',
                    'overlay-padding': 10,
                    'overlay-opacity': 0.3,
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 5,
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle'
                }
            },
            {
                selector: 'edge[type = "r"]',
                style: {
                    'line-color': '#0049FF',
                    'target-arrow-color': '#0049FF',
                }
            },
            {
                selector: 'edge[type = "w"]',
                style: {
                    'line-color': '#890083',
                    'target-arrow-color': '#890083',
                }
            },
            {
                selector: 'edge[type = "rw"]',
                style: {
                    'line-color': '#ccc',
                    'target-arrow-color': '#ccc',
                    'source-arrow-shape': 'triangle',
                    'source-arrow-color': '#ccc',
                }
            }
        ];
    }
    this._style = style;
    this._cy = {};
  }

  Object.defineProperty(GraphWidget.prototype, "cylayout", {
    get: function () {
      return this._cylayout;
    },
    set: function(cylayout) {
      this._cylayout = cylayout;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(GraphWidget.prototype, "graph", {
    get: function () {
      return this._cy;
    },
    enumerable: true,
    configurable: true
  });

  GraphWidget.prototype.onAfterAttach = function (msg) {
    var cont = document.getElementById(this._cyid);
    this._cy =  cytoscape({
        container: cont,
        elements: this._graph,
        style: this._style,
        autoungrabify: false,
        autolock: false,
        layout: this._cylayout
    });
    this._cy.on('tap', 'node', function(evt){
      var node = evt.cyTarget;
      var gnode_id = node._private.data.gnode_id;
      console.log("Clicked on: " + gnode_id);
      $.ajax({url: "../fwdgraph?gnode_id="+gnode_id,
              type: "GET",
              async: true,
              success: function(data){
                  data = $.parseJSON(data)
                  var options = {
                    name: 'breadthfirst',

                    fit: true, // whether to fit the viewport to the graph
                    directed: false, // whether the tree is directed downwards (or edges can point in any direction if false)
                    padding: 30, // padding on fit
                    circle: false, // put depths in concentric circles if true, put depths top down if false
                    spacingFactor: 1.5, // positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
                    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
                    avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
                    maximalAdjustments: 0, // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
                    animate: true, // whether to transition the node positions
                    animationDuration: 500, // duration of animation in ms if enabled
                    animationEasing: undefined, // easing of animation if enabled
                    ready: undefined, // callback on layoutready
                    stop: undefined // callback on layoutstop
                  };
                  var id = 'gnf-'+gnode_id
                  var graph = new GraphWidget(data, options, id);
                  graph.id = id;
                  var bin = node._private.data.name.split('/').reverse()[0]
                  graph.title.text = "[fwd:] " + bin;
                  graph.title.closable = true;
                  cd_app.shell.addToMainArea(graph)
            }});
    //console.log("GraphWidget attach");
    });
  }

  GraphWidget.prototype.onResize = function(msg) {
    this._cy.layout(this.cylayout);
    //console.log("GraphWidget resize");
  };
  GraphWidget.prototype.onAfterShow = function(msg) {
    this._cy.layout(this.cylayout);
    //console.log("GraphWidget show");
  };
  return GraphWidget;
}(pw.Widget));
exports.GraphWidget = GraphWidget;

function createAboutPanel() {
    var widget = new pw.Widget();
    widget.id = 'proctree';
    widget.title.text = 'About Demo';
    widget.title.closable = true;
    widget.addClass('no-content');

    var aboutdiv = document.createElement('div');
    aboutdiv.id = 'about';
  aboutdiv.innerHTML='<center><div class="about-container"><img id="cadets-logo" src="img/logo.png" alt="cadets-console" width="250px"><br><h3>Provenance Graphs from BuildInject scenario traces</h3><div id="about-content"><p>Open the "Sessions" side panel to explore the process tree history as recovered from the BuildInject traces.</p><p>Select a binary in order to see its provenance graph as built by OPUS (backward query). The graph will appear as a new tab in this area.</p><p>Once two graphs are opened, choose File&gt;Graph Diff to get a new graph highlighting the differences. The diff is always done for the last two graphs opened in the main area.</p><p>For the normal (non-diff) provenance graphs, click any of the nodes (e.g. crt1.o) in order to see what files were created from or affected by the selected node (forward query).</p></div></div></center>'
  widget.node.appendChild(aboutdiv);
    return widget;
}
