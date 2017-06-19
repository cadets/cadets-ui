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

var pw = require('phosphor-widget');
var cd_app = {};

exports.procDetailsExtension = {
    id: 'cadets.prov.details',
    activate: activateDetailsPane,
    showDetails: showDetailsPane,
    detailsPane: {},
    opened: false
};

function activateDetailsPane(app) {
    cd_app = app;
    return Promise.resolve();
}

function showDetailsPane(node) {
  $.ajax({url: "../old/filegraph?gnode_id="+node.original.gnode_id,
          type: "GET",
          async: true,
          success: function(data){
              var id = 'details-pane';
              if(exports.procDetailsExtension.opened == false){
                var dw = new DetailsWidget(id, node, data);
                dw.id = id;
                dw.title.closable = true;
                dw.title.text = "Details";
                cd_app.shell.addToMainArea(dw);
                exports.procDetailsExtension.detailsPane = dw;
                exports.procDetailsExtension.opened = true;
              } else {
                dw = exports.procDetailsExtension.detailsPane;
                dw.update(id, node, data);
              }
          }});
}

function convert_to_file_list(data) {
  var cont = document.createElement('div');
  cont.innerHTML="<h3>Files read:</h3>"
  var list_r = document.createElement('ul');
  for(var i=0; i<data.read.length; i++){
    list_r.innerHTML+="<li>"+data.read[i]+"</li>";
  }
  cont.appendChild(list_r);
  cont.innerHTML += "<h3>Files written</h3>";
  var list_w = document.createElement('ul');
  for(var i=0; i<data.written.length; i++){
    list_w.innerHTML+="<li>"+data.written[i]+"</li>";
  }
  cont.appendChild(list_w);

  return cont;
}

var DetailsWidget = (function (_super) {
  __extends(DetailsWidget, _super);
  function DetailsWidget(id, node, data) {
    _super.call(this);
    this.addClass('detailswidget');
    this._cyid = id;
    this._details_for = "";
    this.createDOM(id, node, data);
  }

  DetailsWidget.prototype.createDOM = function(id, node, data) {
    var cont_id = -1;
    if(typeof node.original.pid != "undefined"){
      cont_id = node.original.pid
    } else {
      cont_id = node.original.text
    }
    if(cont_id != this._details_for){
      var proc_det = document.createElement('div');
      proc_det.id = 'tree-details-'+cont_id;
      var title = document.createElement('h2');
      title.classname +='details-title';
      var sub = document.createElement('h3');
      var det_prop = document.createElement('div');
      var det_files = document.createElement('div');

      switch(node.original.type){
        case "default":
          var bin = node.original.binary.split('/').reverse()[0]
          title.innerHTML = "Process: "+bin;
          sub.innerHTML = "pid: "+node.original.pid+" user id: "+node.original.user;
          det_prop.innerHTML = "Command line:<br>" + node.original.cmd;
          break;
        case "server":
          title.innerHTML = "Incoming (accept client: "+node.original.text+")";
          break;
        case "client":
          title.innerHTML = "Outgoing (connect to: "+node.original.text+")";
      }
      proc_det.appendChild(title);
      proc_det.appendChild(sub);
      proc_det.appendChild(det_prop);
      proc_det.appendChild(det_files);

      if(node.original.type == "default") {
        $.ajax({url: "../old/provdetail?gnode_id="+(node.original.gnode_id - 2),
                type: "GET",
                async: true,
                success: function(data) {
                  var fdata = convert_to_file_list(data);
                  det_files.appendChild(fdata);
                  }
                }
              );
      }

      if(this._details_for != "") {
        document.getElementById('details-pane').innerHTML='';
      }
      this.node.appendChild(proc_det);
      this._details_for = cont_id;
    }
  }

  DetailsWidget.prototype.onAfterAttach = function (msg) {
    var cont = document.getElementById(this._cyid);
  };

  DetailsWidget.prototype.update = function (id, node, data) {
    this.createDOM(id, node, data);
  };

  return DetailsWidget;
}(pw.Widget));
exports.DetailsWidget = DetailsWidget;
