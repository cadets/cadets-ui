# Copyright 2018 Jonathan Anderson
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

GoldenLayout = require 'golden-layout'
require 'golden-layout/src/css/goldenlayout-base.css'
require 'golden-layout/src/css/goldenlayout-light-theme.css'


class Layout
  constructor: (@root, queries) ->
    #
    # Rendezvous point for node inspection: when various kinds of inspectors
    # are created (e.g., property list, neighbour graph) they should append
    # themselves to this array.
    #
    inspectors = []
    registerInspector = (i) -> inspectors.push i
    inspect = (node) ->
      for i in inspectors
        i.inspect node

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
                        componentState:
                          inspect: (node) -> inspect node
                          search: (filters, cb) -> queries.processes filters, cb
                    },{
                        type: 'component',
                        componentName: 'Files',
                    }],
                },{
                    type: 'component',
                    componentName: 'Worksheet',
                },{
                    type: 'component',
                    componentName: 'Inspector',
                    componentState:
                      registerInspector: registerInspector
                }]
              }
            ]
            @root

    #@layout.on 'stateChanged', () ->
    #  state = JSON.stringify g.toConfig()
    #  localStorage.setItem 'savedLayout', state

    @layout.on 'tabCreated', (tab) ->
      tab.closeElement
        .off 'click'
        .click () ->
          confirm 'yes?'

    layout = @layout
    registerMarko = (componentName, markoComponent) ->
      layout.registerComponent componentName, (container, state) ->
        markoComponent
          .renderSync state
          .appendTo container.getElement().get()[0]

    registerMarko 'Files', require './components/file-search-pane.marko'
    registerMarko 'Processes', require './components/process-search-pane.marko'
    registerMarko 'Inspector', require './components/inspector.marko'

    @worksheets = worksheets = []

    layout.registerComponent 'Worksheet', (container, state) ->
      worksheets.push(
        require './components/worksheet.marko'
          .renderSync state
          .appendTo container.getElement().get()[0]
      )

    @layout.init()

  reset: ->
    localStorage.setItem 'savedLayout', null

  resize: =>
    @layout.updateSize()


module.exports = (args...) ->
  new Layout(args...)

