/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';
var phosphor_widget_1 = require('phosphor-widget');
//var $ = require('jquery');
var jstree = require('jstree');
var graph = require('_/opus-console/prov-graphs/index').provGraphExtension
var my_app;

exports.procTreeExtension = {
    id: 'cadets.sidebar.proctree',
    activate: activateprocTree
};
function createCommandItem(id, message) {
    return { id: id, handler: function () { console.log("COMMAND: " + message); } };
}

function convert_to_jstree(node_array) {
  if(node_array.length==0) return;
  var arr = []
  for(var i in node_array) {
    var node = node_array[i];
    var tree_node = { id: node.id,
                      binary: node.exe,
                      icon: "fa fa-cube",
                      pid: node.pid,
                      gnode_id: node.gnode_id,
                      state: { opened: false },
                      children: convert_to_jstree(node.children)
                     };
    if('user' in node){
        tree_node.user = node.user;
        if('ip' in node){
            tree_node.ip = node.ip;
            tree_node.text = `${node.exe} [${node.user}@${node.ip} - ${node.pid}]`;
        } else {
            tree_node.text = `${node.exe} [${node.user} - ${node.pid}]`;
        }
    } else {
        tree_node.text = `${node.exe} [${node.pid}]`;
    }
    arr.push(tree_node);
  }
  return arr;
}

function load_proctree(dom_node) {
 $.ajax({url: "../proctree",
         type: "GET",
         async: true,
         success: function(data) {
           var jdata = convert_to_jstree($.parseJSON(data))
           $("#"+dom_node.id)
           .on('activate_node.jstree', function(ev, node) {
              graph.addGraph(node.node);
           })
           .jstree({
           'core': {
             'themes' : { },
             'data': jdata
           },
           'plugins':['wholerow', 'search']
           });
          }
        }
      );

}

function activateprocTree(app) {
    var widget = new phosphor_widget_1.Widget();
    widget.id = 'proctree';
    widget.title.text = 'Sessions';
    widget.addClass('proctree-content');
    app.shell.addToLeftArea(widget, { rank: 10 });

    /* TODO(lc525) add search */

    let div = document.createElement('div');
    div.id = 'proctree_host';
    widget.node.appendChild(div);
    load_proctree(div);
    return Promise.resolve();
}
