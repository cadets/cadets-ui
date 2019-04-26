# Copyright 2018 Jonathan Anderson
# Copyright 2019 Nadia Shalaby
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

require 'bootstrap'
require 'bootstrap/dist/css/bootstrap.min.css'
cytoscape = require 'cytoscape'


GoldenLayout = require 'golden-layout'
require 'golden-layout/src/css/goldenlayout-base.css'
require 'golden-layout/src/css/goldenlayout-light-theme.css'


class Layout
  constructor: (@root) ->
    ui = this

    savedLayout = localStorage.getItem 'savedLayout'

    if savedLayout != null and savedLayout != 'null'
        @layout = new GoldenLayout JSON.parse(savedLayout), @root
    else
        @layout = new GoldenLayout
            content: [
              {
                type: 'row',
                content:[{
                    type: 'stack',
                    content: [{
                        type: 'component',
                        componentName: 'Processes',
                    },{
                        type: 'component',
                        componentName: 'Files',
                    }],
                },{
                    type: 'component',
                    componentName: 'Worksheet',
                },{
                    type: 'column',
                    content: [{
                      type: 'component',
                      componentName: 'Neighbours',
                    },
                    {
                      type: 'component',
                      componentName: 'Properties',
                    }]
                }]
              }
            ]
            @root

    @layout.on 'stateChanged', () ->
      if ui.layout.isInitialized
        state = JSON.stringify ui.layout.toConfig()
        localStorage.setItem 'savedLayout', state

    @layout.on 'tabCreated', (tab) ->
      tab.closeElement
        .off 'click'
        .click () ->
          confirm 'yes?'

    layout = @layout
    registerMarko = (componentName, markoComponent) ->
      layout.registerComponent componentName, (container, state) ->
        markoComponent
          .renderSync ui
          .appendTo container.getElement().get()[0]

    registerMarko 'Files', require './components/file-search-pane.marko'
    registerMarko 'Processes', require './components/process-search-pane.marko'
    registerMarko 'Neighbours', require './components/inspector.marko'
    registerMarko 'Properties', require './components/node-properties.marko'
   

    @worksheets = worksheets = []

    layout.registerComponent 'Worksheet', (container, state) ->
      worksheets.push(
        require './components/worksheet.marko'
          .renderSync ui
          .appendTo container.getElement().get()[0]
      )

    @layout.init()

  #
  # All of the components that can inspect nodes with an `inspect(node)` method,
  # e.g., the "Neighbours" and "Properties" components.
  #
  inspectors: []

  #
  # All of the components that afford search functionality and that need to be
  # kicked when we first connect to the database. Registering these components
  # allows us to kick off an initial search and populate the UI with real data
  # before the user has to type anything.
  #
  searchers: []

  dbConnected: (db) =>
    @database = db
    for s in @searchers
      s.search()

  inspect: (node) ->
    for i in @inspectors
      i.inspect node, @database

  registerInspector: (i) => @inspectors.push i
  registerSearcher: (s) => @searchers.push s

  reset: ->
    localStorage.setItem 'savedLayout', null

  resize: =>
    @layout.updateSize()


module.exports = (args...) ->
  new Layout(args...)

