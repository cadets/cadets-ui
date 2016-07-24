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


exports.headerExtension = {
    id: 'cadets.topbar.header',
    activate: activateHeader
};
function createCommandItem(id, message) {
    return { id: id, handler: function () { console.log("COMMAND: " + message); } };
}

var logHandler = function(item) {
  console.log(item.text);
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
        text: 'Exit',
        shortcut: 'Ctrl+X',
        handler: logHandler,
      }),
  ]);
  return root;
}

function activateHeader(app) {


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
