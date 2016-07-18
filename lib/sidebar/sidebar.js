"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
var arrays = require('phosphor-arrays');
var phosphor_domutil_1 = require('phosphor-domutil');
var phosphor_properties_1 = require('phosphor-properties');
var phosphor_signaling_1 = require('phosphor-signaling');
var phosphor_widget_1 = require('phosphor-widget');
require('./sidebar.css');
/**
 * The class name added to SideBar instances.
 */
var SIDE_BAR_CLASS = 'p-SideBar';
/**
 * The class name added to the side bar content node.
 */
var CONTENT_CLASS = 'p-SideBar-content';
/**
 * The class name added to side bar button nodes.
 */
var BUTTON_CLASS = 'p-SideBar-button';
/**
 * The class name added to a side bar button text node.
 */
var TEXT_CLASS = 'p-SideBar-button-text';
/**
 * The class name added to a side bar button icon node.
 */
var ICON_CLASS = 'p-SideBar-button-icon';
/**
 * The class name added to the current side bar button.
 */
var CURRENT_CLASS = 'p-mod-current';
/**
 * A widget which displays titles as a row of exclusive buttons.
 */
var SideBar = (function (_super) {
    __extends(SideBar, _super);
    /**
     * Construct a new side bar.
     */
    function SideBar() {
        _super.call(this);
        this._dirty = false;
        this._titles = [];
        this.addClass(SIDE_BAR_CLASS);
    }
    /**
     * Create the DOM node for a side bar.
     */
    SideBar.createNode = function () {
        var node = document.createElement('div');
        var content = document.createElement('ul');
        content.className = CONTENT_CLASS;
        node.appendChild(content);
        return node;
    };
    /**
     * Dispose of the resources held by the widget.
     */
    SideBar.prototype.dispose = function () {
        this._titles.length = 0;
        _super.prototype.dispose.call(this);
    };
    Object.defineProperty(SideBar.prototype, "currentChanged", {
        /**
         * A signal emitted when the current side bar title is changed.
         */
        get: function () {
            return SideBarPrivate.currentChangedSignal.bind(this);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SideBar.prototype, "currentTitle", {
        /**
         * Get the currently selected side bar title.
         */
        get: function () {
            return SideBarPrivate.currentTitleProperty.get(this);
        },
        /**
         * Set the currently selected side bar title.
         */
        set: function (value) {
            SideBarPrivate.currentTitleProperty.set(this, value);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SideBar.prototype, "contentNode", {
        /**
         * Get the content node which holds the side bar buttons.
         *
         * #### Notes
         * Modifying this node can lead to undefined behavior.
         *
         * This is a read-only property.
         */
        get: function () {
            return this.node.getElementsByClassName(CONTENT_CLASS)[0];
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Get the number of title objects in the side bar.
     *
     * @returns The number of title objects in the side bar.
     */
    SideBar.prototype.titleCount = function () {
        return this._titles.length;
    };
    /**
     * Get the title object at the specified index.
     *
     * @param index - The index of the title object of interest.
     *
     * @returns The title at the specified index, or `undefined`.
     */
    SideBar.prototype.titleAt = function (index) {
        return this._titles[index];
    };
    /**
     * Get the index of the specified title object.
     *
     * @param title - The title object of interest.
     *
     * @returns The index of the specified title, or `-1`.
     */
    SideBar.prototype.titleIndex = function (title) {
        return this._titles.indexOf(title);
    };
    /**
     * Add a title object to the end of the side bar.
     *
     * @param title - The title object to add to the side bar.
     *
     * #### Notes
     * If the title is already added to the side bar, it will be moved.
     */
    SideBar.prototype.addTitle = function (title) {
        this.insertTitle(this.titleCount(), title);
    };
    /**
     * Insert a title object at the specified index.
     *
     * @param index - The index at which to insert the title.
     *
     * @param title - The title object to insert into to the side bar.
     *
     * #### Notes
     * If the title is already added to the side bar, it will be moved.
     */
    SideBar.prototype.insertTitle = function (index, title) {
        var n = this.titleCount();
        var i = this.titleIndex(title);
        var j = Math.max(0, Math.min(index | 0, n));
        if (i !== -1) {
            if (j === n)
                j--;
            if (i === j)
                return;
            arrays.move(this._titles, i, j);
        }
        else {
            arrays.insert(this._titles, j, title);
            title.changed.connect(this._onTitleChanged, this);
        }
        this._dirty = true;
        this.update();
    };
    /**
     * Remove a title object from the side bar.
     *
     * @param title - The title object to remove from the side bar.
     *
     * #### Notes
     * If the title is not in the side bar, this is a no-op.
     */
    SideBar.prototype.removeTitle = function (title) {
        var i = arrays.remove(this._titles, title);
        if (i === -1) {
            return;
        }
        title.changed.disconnect(this._onTitleChanged, this);
        if (this.currentTitle === title)
            this.currentTitle = null;
        this._dirty = true;
        this.update();
    };
    /**
     * Handle the DOM events for the side bar.
     *
     * @param event - The DOM event sent to the side bar.
     *
     * #### Notes
     * This method implements the DOM `EventListener` interface and is
     * called in response to events on the side bar's DOM node. It should
     * not be called directly by user code.
     */
    SideBar.prototype.handleEvent = function (event) {
        if (event.type === 'mousedown') {
            this._evtMouseDown(event);
        }
    };
    /**
     * A message handler invoked on an `'after-attach'` message.
     */
    SideBar.prototype.onAfterAttach = function (msg) {
        this.node.addEventListener('mousedown', this);
    };
    /**
     * A message handler invoked on a `'before-detach'` message.
     */
    SideBar.prototype.onBeforeDetach = function (msg) {
        this.node.removeEventListener('mousedown', this);
    };
    /**
     * A message handler invoked on an `'update-request'` message.
     */
    SideBar.prototype.onUpdateRequest = function (msg) {
        if (this._dirty) {
            this._dirty = false;
            SideBarPrivate.updateButtons(this);
        }
        else {
            SideBarPrivate.updateCurrent(this);
        }
    };
    /**
     * Handle the `'mousedown'` event for the side bar.
     */
    SideBar.prototype._evtMouseDown = function (event) {
        // Do nothing if it's not a left mouse press.
        if (event.button !== 0) {
            return;
        }
        // Do nothing if the press is not on a button.
        var i = SideBarPrivate.hitTestButtons(this, event.clientX, event.clientY);
        if (i < 0) {
            return;
        }
        // Pressing on a button stops the event propagation.
        event.preventDefault();
        event.stopPropagation();
        // Update the current title.
        var title = this._titles[i];
        if (title !== this.currentTitle) {
            this.currentTitle = title;
        }
        else {
            this.currentTitle = null;
        }
    };
    /**
     * Handle the `changed` signal of a title object.
     */
    SideBar.prototype._onTitleChanged = function () {
        this._dirty = true;
        this.update();
    };
    return SideBar;
}(phosphor_widget_1.Widget));
exports.SideBar = SideBar;
/**
 * The namespace for the `SideBar` class private data.
 */
var SideBarPrivate;
(function (SideBarPrivate) {
    /**
     * A signal emitted when the current title is changed.
     */
    SideBarPrivate.currentChangedSignal = new phosphor_signaling_1.Signal();
    /**
     * The property descriptor for the current side bar title.
     */
    SideBarPrivate.currentTitleProperty = new phosphor_properties_1.Property({
        name: 'currentTitle',
        value: null,
        coerce: coerceCurrentTitle,
        changed: onCurrentTitleChanged,
        notify: SideBarPrivate.currentChangedSignal,
    });
    /**
     * Update the side bar buttons to match the current titles.
     *
     * This is a full update which also updates the currrent state.
     */
    function updateButtons(owner) {
        var count = owner.titleCount();
        var content = owner.contentNode;
        var children = content.children;
        while (children.length > count) {
            content.removeChild(content.lastChild);
        }
        while (children.length < count) {
            content.appendChild(createButtonNode());
        }
        for (var i = 0; i < count; ++i) {
            var node = children[i];
            updateButtonNode(node, owner.titleAt(i));
        }
        updateCurrent(owner);
    }
    SideBarPrivate.updateButtons = updateButtons;
    /**
     * Update the current state of the buttons to match the side bar.
     *
     * This is a partial update which only updates the current button
     * class. It assumes the button count is the same as the title count.
     */
    function updateCurrent(owner) {
        var count = owner.titleCount();
        var content = owner.contentNode;
        var children = content.children;
        var current = owner.currentTitle;
        for (var i = 0; i < count; ++i) {
            var node = children[i];
            if (owner.titleAt(i) === current) {
                node.classList.add(CURRENT_CLASS);
            }
            else {
                node.classList.remove(CURRENT_CLASS);
            }
        }
    }
    SideBarPrivate.updateCurrent = updateCurrent;
    /**
     * Get the index of the button node at a client position, or `-1`.
     */
    function hitTestButtons(owner, x, y) {
        var nodes = owner.contentNode.children;
        for (var i = 0, n = nodes.length; i < n; ++i) {
            if (phosphor_domutil_1.hitTest(nodes[i], x, y))
                return i;
        }
        return -1;
    }
    SideBarPrivate.hitTestButtons = hitTestButtons;
    /**
     * The coerce handler for the `currentTitle` property.
     */
    function coerceCurrentTitle(owner, value) {
        return (value && owner.titleIndex(value) !== -1) ? value : null;
    }
    /**
     * The change handler for the `currentTitle` property.
     */
    function onCurrentTitleChanged(owner) {
        owner.update();
    }
    /**
     * Create an uninitialized DOM node for a side bar button.
     */
    function createButtonNode() {
        var node = document.createElement('li');
        var icon = document.createElement('span');
        var text = document.createElement('span');
        text.className = TEXT_CLASS;
        node.appendChild(icon);
        node.appendChild(text);
        return node;
    }
    /**
     * Update a button node to reflect the state of a title.
     */
    function updateButtonNode(node, title) {
        var icon = node.firstChild;
        var text = node.lastChild;
        if (title.className) {
            node.className = BUTTON_CLASS + ' ' + title.className;
        }
        else {
            node.className = BUTTON_CLASS;
        }
        if (title.icon) {
            icon.className = ICON_CLASS + ' ' + title.icon;
        }
        else {
            icon.className = ICON_CLASS;
        }
        text.textContent = title.text;
    }
})(SideBarPrivate || (SideBarPrivate = {}));
