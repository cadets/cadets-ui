# Copyright 2017-2018 Jonathan Anderson
# Copyright 2018 Garrett Kirkland
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

cytoscape = require 'cytoscape'
cytoscape.use require 'cytoscape-cxtmenu'
cytoscape.use require 'cytoscape-cose-bilkent'
cytoscape.use require 'cytoscape-dagre'

style = require './graph-style.coffee'


class PvmGraph
  constructor: (container) ->
    args =
      container: container
      style: style

    @cy = new cytoscape(args)

  addNode: (node) ->
    cyNode =
      id: node.id
      classes: node.style_name
      data:
        label: node.label

    @cy.add cyNode

  clear: () ->
    @cy.nodes().remove()

  layout: (algorithm) ->
    @cy.layout
      name: algorithm
      rankDir: 'LR'
      animate: false
    .run()


#
# Create a new graph.
#
exports.create = (container = null) ->
  new PvmGraph(container)
