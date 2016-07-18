'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};

var ui = {
  dp : require('phosphor-dockpanel'),
  w  : require('phosphor-widget'),
  sp : require('phosphor-splitpanel'),
  bp : require('phosphor-boxpanel'),
  m : require('phosphor-menus'),
  sd : require('_/sidebar/sidebar.js')
};

function defineCommands() {
  commands.addCommand('example:copy', {
    label: 'Copy',
    mnemonic: 1,
    icon: 'fa fa-copy',
    execute: function () {
      console.log('Copy');
    }
  });
  commands.addCommand('example:paste', {
    label: 'Paste',
    mnemonic: 1,
    icon: 'fa fa-paste',
    execute: function () {
      console.log('Paste');
    }
  });
  commands.addCommand('close', {
    label: 'Close',
    mnemonic: 1,
    icon: 'fa fa-close',
    execute: function () {
      console.log('Close');
    }
  });
}

var logHandler = function(item) {
  console.log(item.text);
}

function createFileMenu() {
  var root = new ui.m.Menu([
      new ui.m.MenuItem({
        text: 'Copy',
        shortcut: 'Ctrl+C',
        icon: 'fa fa-copy',
        handler: logHandler,
      }),
      new ui.m.MenuItem({
        text: 'Paste',
        icon: 'fa fa-paste',
        shortcut: 'Ctrl+V',
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

function createSidebar() {
  var widget = new ui.w.Widget();
  widget.addClass('sidebar');
  widget.title.text = "Tools";
  widget.title.closable = false;
  return widget;
}

function createGraphArea() {
  var widget = new ui.w.Widget();
  widget.addClass('graph-area');
  widget.title.text = "History";
  widget.title.closable = true;
  return widget;
}

function main() {
  var f_menu = createFileMenu();

  var bar = new ui.m.MenuBar([
    new ui.m.MenuItem({
      text: 'File',
      submenu: f_menu
    })
  ]);

  var panel = new ui.sp.SplitPanel();
  panel.orientation = ui.sp.SplitPanel.Horizontal;
  panel.id = 'opus-console';

  var dock = new ui.dp.DockPanel();
  dock.id = 'opus-content';

  var sidebar = createSidebar();
  var graph1 = createGraphArea();

  dock.insertLeft(sidebar);
  dock.insertRight(graph1, sidebar);

  panel.addChild(dock);

  window.onresize = function(){ panel.update() };
  bar.attach(document.getElementById('menubar-host'));
  panel.attach(document.getElementById('panel-content'));

}

window.onload = main;
