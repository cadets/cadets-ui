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
var details = require('_/opus-console/proc_tree/details').procDetailsExtension
var my_app;

exports.procTreeExtension = {
    id: 'cadets.sidebar.proctree',
    activate: createSidebar
};
function createCommandItem(id, message) {
    return { id: id, handler: function () { console.log("COMMAND: " + message); } };
}
function createSidebar(app) {
  activateprocTree(app)
  activatedbList(app)
}

function get_type(conn) {
  if(conn.conn_type == "SERVER")
    return "server";
  else
    return "client";
}

function showDetails(node) {
  details.showDetails(node);
}

function showHistory(node) {
  graph.addGraph(node);
}

function tree_node_select(dom_node, data) {
  var controls = document.createElement('span');
  controls.id="ctrl-"+data.node.id;
  controls.className += "tree_ctrls"
  controls.innerHTML="<a id='det-"+data.node.id+"'>details</a>";

  if(data.node.original.type == "default"){
    controls.innerHTML +="<a id='hist-"+data.node.id+"'>history</a>";
  }

  $('#'+data.node.id+"_anchor").append(controls);
  $('#det-'+data.node.id).click( function(e){
    showDetails(data.node);
  });

  if(data.node.original.type == "default"){
    $('#hist-'+data.node.id).click( function(e){
      showHistory(data.node);
    });
  }
}

function tree_node_deselect(dom_node, data) {
  $('#ctrl-'+data.node.id).remove()
}

function tree_node_deselect_all(dom_node, data) {
  for(var ix = 0; ix < data.node.length; ix++){
    $('#ctrl-'+data.node[ix]).remove()
  }
}

function convert_to_jstree(node_array) {
  if(node_array.length==0) return;
  var arr = []
  for(var i in node_array) {
    var node = node_array[i];
    var conn_list = [];
    for(var j in node.net_conns){
      conn_list.push({id: "tn"+(node.timestamp*10+j),
                      type: get_type(node.net_conns[j]),
                      state: { opened: true},
                      text: node.net_conns[j].ip});
    }
    var tree_node = { id: "tn"+node.timestamp,
                      binary: node.name,
                      type: "default",
                      pid: node.pid,
                      cmd: node.cmd,
                      gnode_id: node.gnode_id,
                      state: { opened: false },
                      children: conn_list.concat(convert_to_jstree(node.children))
                     };
    if('user' in node){
        tree_node.user = node.user;
        tree_node.text = `${node.pid}: ${node.name} [usr: ${node.user}]`;
    } else {
        tree_node.text = `${node.name} [${node.pid}]`;
    }
    arr.push(tree_node);
  }
  return arr;
}

function load_proctree(dom_node) {
 $.ajax({url: "../old/proctree",
         type: "GET",
         async: true,
         success: function(data) {
           var jdata = convert_to_jstree(data)
           $("#"+dom_node.id)
           .on('select_node.jstree', function(ev, d) {
              tree_node_select(dom_node, d);
              //graph.addGraph(node.node);
           })
           .on('deselect_node.jstree', function(ev, d) {
              tree_node_deselect(dom_node, d);
              //graph.addGraph(node.node);
           })
           .on('deselect_all.jstree', function(ev, d) {
              tree_node_deselect_all(dom_node, d);
              //graph.addGraph(node.node);
           })
           .jstree({
           'core': {
             'themes' : { },
             'data': jdata,
             'html_titles': true,
             'check_callback': true
           },
           'types': {
             'default': {
               'icon': 'fa fa-file-o icon-default'
             },
             'server': {
               "icon": "fa fa-arrow-right yellow"
             },
             'client': {
               'icon': 'fa fa-arrow-left blue'
             }
           },
           'plugins':['wholerow', 'types', 'search']
           });
           var to = false;
           $('#tree_search').keyup(function () {
             if(to) { clearTimeout(to); }
             to = setTimeout(function () {
               var v = $('#tree_search').val();
               $('#'+dom_node.id).jstree(true).search(v);
             }, 1000);
           });
          }
        }
      );

}

function activateprocTree(app) {
    var widget = new phosphor_widget_1.Widget();
    widget.id = 'proctree';
    widget.title.text = "Processes";
    widget.addClass('proctree-content');
    app.shell.addToLeftArea(widget, { rank: 10 });

    widget.node.innerHTML = '<form id="search_bar"><label for="tree_search">Search:</label><input type="text" id="tree_search" value="" class="input"></form>'

    let div = document.createElement('div');
    div.id = 'proctree_host';

    widget.node.appendChild(div);
    load_proctree(div);
    //$(.jstree-node).mouseenter

    return Promise.resolve();
}

function activatedbList(app) {
    my_app = app
    var widget = new phosphor_widget_1.Widget();
    widget.id = 'dblist';
    widget.title.text = 'Databases';
    widget.addClass('proctree-content');
    app.shell.addToLeftArea(widget, { rank: 10 });

    widget.node.innerHTML = '<div id="db_search_bar"><label for="db_search">Search:</label><input type="text" id="db_search" value="" class="input"></div>'

    let div = document.createElement('div');
    div.id = 'db_host';

    widget.node.appendChild(div);

    return Promise.resolve();
}
