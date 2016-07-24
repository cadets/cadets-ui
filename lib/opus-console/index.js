'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var phosphide = require('phosphide/lib/core/application')
var tree = require('_/opus-console/proc_tree/index').procTreeExtension
var graph = require('_/opus-console/prov-graphs/index').provGraphExtension
var menu = require('_/opus-console/header/index').headerExtension

var components = [tree, graph, menu]


var app = new phosphide.Application({extensions: components});



var ui = {
  dp : require('phosphor-dockpanel'),
  w  : require('phosphor-widget'),
  sp : require('phosphor-splitpanel'),
  bp : require('phosphor-boxpanel'),
  m : require('phosphor-menus'),
  sd : require('_/sidebar/sidebar.js')
};

function defineCommands() {
  commands.addCommand('file:about', {
    label: 'About',
    mnemonic: 1,
    icon: 'fa fa-about',
    execute: function () {
      console.log('About');
    }
  });
}

var logHandler = function(item) {
  console.log(item.text);
}

function createFileMenu() {
  var root = new ui.m.Menu([
      new ui.m.MenuItem({
        text: 'About',
        shortcut: 'Ctrl+A',
        icon: 'fa fa-info-circle',
        handler: logHandler,
      }),
      new ui.m.MenuItem({
        type: ui.m.MenuItem.Separator
      }),
      new ui.m.MenuItem({
        text: 'Exit',
        shortcut: 'Ctrl+X',
        handler: logHandler,
      }),
  ]);
  return root;
}

function main() {
/*
 *  var f_menu = createFileMenu();
 *
 *  var bar = new ui.m.MenuBar([
 *    new ui.m.MenuItem({
 *      text: 'File',
 *      submenu: f_menu
 *    })
 *  ]);
 *  bar.attach(document.getElementById('menubar-host'));
 */

  app.run().then(function() {
  });

}

window.onload = main;
