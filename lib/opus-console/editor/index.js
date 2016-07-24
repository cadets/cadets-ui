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
var CodeMirror = require('codemirror');
var phosphor_widget_1 = require('phosphor-widget');
require('codemirror/lib/codemirror.css');
require('codemirror/mode/javascript/javascript.js');
exports.editorExtension = {
    id: 'phosphide.example.editor',
    activate: activateEditor
};
function activateEditor(app) {
    for (var i = 0; i < 5; ++i) {
        var editor = createEditor(i);
        app.shell.addToMainArea(editor);
    }
    return Promise.resolve();
}
function createEditor(n) {
    var widget = new CodeMirrorWidget({
        mode: 'text/typescript',
        lineNumbers: true,
        tabSize: 2,
    });
    widget.id = "editor-" + n;
    widget.title.text = "Untitled - " + n + ".ts";
    return widget;
}
var CodeMirrorWidget = (function (_super) {
    __extends(CodeMirrorWidget, _super);
    function CodeMirrorWidget(config) {
        _super.call(this);
        this.addClass('editor-CodeMirrorWidget');
        this._editor = CodeMirror(this.node, config);
    }
    Object.defineProperty(CodeMirrorWidget.prototype, "editor", {
        get: function () {
            return this._editor;
        },
        enumerable: true,
        configurable: true
    });
    CodeMirrorWidget.prototype.onAfterAttach = function (msg) {
        this._editor.refresh();
    };
    CodeMirrorWidget.prototype.onResize = function (msg) {
        if (msg.width < 0 || msg.height < 0) {
            this._editor.refresh();
        }
        else {
            this._editor.setSize(msg.width, msg.height);
        }
    };
    return CodeMirrorWidget;
}(phosphor_widget_1.Widget));
