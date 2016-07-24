/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';
var pw = require('phosphor-widget');
var ph_m = require('phosphor-menus');
var gr = require('_/opus-console/prov-graphs/index');

var cd_app = {};
var node_list = [];

exports.headerExtension = {
    id: 'cadets.topbar.header',
    activate: activateHeader,
    diffAdd: addToDiffList,
    diffClear: clearDiff
};
function createCommandItem(id, message) {
    return { id: id, handler: function () { console.log("COMMAND: " + message); } };
}

var logHandler = function(item) {
  console.log(item.text);
}

var diff_handler = function(item) {
  if(node_list.length<2) return;
  var r1 = node_list[0];
  var r2 = node_list[1];
  node_list = [];

  var style= [ // the stylesheet for the graph
      {
          selector: 'node',
          style: {
              'background-color': '#666666',
              'label': 'data(name)',
              'background-opacity': '0.3'
          }
      },
      {
          selector: 'node[chg = "del"]',
          style: {
              'background-color': '#ff0000',
              'label': 'data(name)',
              'background-opacity': '1.0'
          }
      },
      {
          selector: 'node[chg = "add"]',
          style: {
              'background-color': '#00ff00',
              'label': 'data(name)',
              'background-opacity': '1.0'
          }
      },
      {
          selector: 'edge',
          style: {
              'width': 3,
              'curve-style': 'bezier',
              'line-color': '#e6e6e6',
              'target-arrow-color': '#e6e6e6',
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
  ];
  $.ajax({url: "../diffgraph?gnode_id1="+r1+"&gnode_id2="+r2,
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
              var id = 'gdiff-'+r1+'-'+r2;
              var graph = new gr.GraphWidget(data, options, id, style);
              graph.id = id;
              graph.title.text = "diff";
              graph.title.closable = true;
              cd_app.shell.addToMainArea(graph)
          }});
}

function addToDiffList(gnode_id){
  node_list.push(gnode_id);
}

function clearDiff() {
  node_list = [];
}

function createFileMenu() {
  var root = new ph_m.Menu([
      new ph_m.MenuItem({
        text: 'About',
        shortcut: 'Ctrl+A',
        icon: 'fa fa-info-circle',
        handler: logHandler,
      }),
      new ph_m.MenuItem({
        type: ph_m.MenuItem.Separator
      }),
      new ph_m.MenuItem({
        text: 'Graph Diff',
        shortcut: 'Ctrl+D',
        handler: diff_handler,
      }),
  ]);
  return root;
}

function activateHeader(app) {
    cd_app = app;

    var f_menu = createFileMenu();

    var bar = new ph_m.MenuBar([
      new ph_m.MenuItem({
        text: 'File',
        submenu: f_menu
      })
    ]);
    bar.id = 'opus-menu';


    app.shell.addToTopArea(bar, { rank: 10 });
    return Promise.resolve();
}
