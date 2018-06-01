# Copyright 2017 Jonathan Anderson
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


class PvmGraph
  constructor: (container) ->
    args = {}
    #boxSelectionEnabled: true

    if container != null
      args.container = container

    @cy = new cytoscape(args)
    @load_graph_style()

  add_node: (node) ->
    @cy.add
      data:
        label: node.name

  layout: (algorithm) ->
    @cy.layout
      name: algorithm
      rankDir: 'LR'
      animate: true
    .run()

  #
  # Apply Cytograph CSS to the graph.
  #
  # Unfortunately this is hard to do statically.
  #
  load_graph_style: () =>
    colours =
      file: '#dc9'
      important: 'orange'
      pipe: '#076928'
      socket: '#999'
      text: 'black'

    images =
      connection: require './img/connection.png'
      proc: require './img/proc.png'
      file_version: require './img/file-version.png'
      edit_session: require './img/edit-session.png'
      cadets_machine: require './img/cadets-machine.svg'
      machine_external: require './img/machine-external.svg'
      pipe: require './img/pipe.png'
      socket: require './img/socket.png'

    ###
    @cy.style().fromString(
      "core {
        active-bg-color: #7a7a7a; }

      edge {
        curve-style: bezier;
        font-family: Avenir, Helvetica Neue, Helvetica, sans-serif;
        source-arrow-shape: none;
        mid-target-arrow-shape: triangle;
        arrow-scale: 2;
        width: 8;
        text-halign: center;
        text-valign: center;
        text-outline-width: 2;
        color: blue; }

      edge.parent {
        line-style: dotted;
        width: 8;
        target-arrow-color: #366;
        mid-target-arrow-color: #366;
        line-color: #366;
        text-outline-color: #366; }

      edge.file-change {
        line-style: dotted;
        target-arrow-color: #633;
        mid-target-arrow-color: #633;
        line-color: #633;
        text-outline-color: #633; }

      edge.io {
         target-arrow-color: #633;
         mid-target-arrow-color: #633;
         line-color: #633;
         text-outline-color: #633; }

      edge.comm {
        line-style: dashed;
        target-arrow-color: #633;
        mid-target-arrow-color: #633;
        line-color: #633;
         text-outline-color: #633; }

      edge.proc-change {
        line-style: dashed;
        target-arrow-color: #366;
        mid-target-arrow-color: #366;
        line-color: #366;
        text-outline-color: #366; }

      edge.proc-metadata {
        line-style: dotted;
        target-arrow-color: #366;
        mid-target-arrow-color: #366;
        line-color: #366;
        text-outline-color: #366; }

      edge.inf {
        line-style: dotted;
        target-arrow-color: #633;
        mid-target-arrow-color: #633;
        line-color: #633;
        text-outline-color: #633; }

      edge.describes {
        target-arrow-color: #8c4a00;
        mid-target-arrow-color: #8c4a00;
        line-color: #8c4a00;
        text-outline-color: #8c4a00; }

      node {
        content: data(label);
        font-family: Inconsolata, Source Code Pro, Consolas, monospace;
        border-style: solid;
        border-width: 2;
        color: #{colours.text};
        text-outline-color: #eee;
        text-outline-opacity: 0.9;
        text-outline-width: 0;
        text-halign: center;
        text-valign: bottom;
        text-wrap: wrap;
        text-max-width: 8em;
        height: 4em;
        width: 4em;
        background-fit: contain;
        background-position-x: 0;
        background-position-y: 0; }

      node:selected {
          overlay-color: #720d00;
          overlay-opacity: 0.5;
          overlay-padding: 5; }

      node:active {
          overlay-color: #474747;
          overlay-opacity: 0.5;
          overlay-padding: 5; }

      node.annotation {
        shape: octagon; }

      node.annotationActive {
        background-color: #720d00; }

      node.important {
        overlay-color: #{colours.important};
        overlay-padding: 64;
        overlay-opacity: 0.50; }
      
      node.connection {
        shape: rectangle;
        background-image: #{images.connection};
        background-opacity: 0;
        border-opacity: 0;
        width: 135px;
        height: 135px; }

      node.process {
        shape: ellipse;
        background-image: #{images.proc};
        background-opacity: 0;
        border-opacity: 0;
        width: 135px;
        height: 135px; }

      node.file {
        background-color: #{colours.file};
        background-opacity: 0.25;
        border-color: #633; }

      node.file-version {
        shape: rectangle;
        content: '';
        text-opacity: 0;
        background-image: #{images.file_version};
        background-opacity: 0;
        border-width: 0; }

      node.edit {
        background-color: #000;
        background-opacity: 0.25;
        border-color: #633; }

      node.edit-session {
        shape: rectangle;
        content: '';
        text-opacity: 0;
        background-image: #{images.edit_session};
        background-opacity: 0;
        border-width: 0; }

      node.global {
        shape: triangle; }

      node.machine {
        font-size: 48pt;
        text-valign: top;
        shape: rectangle;
        padding: 4em;
        width: 180px;
        height: 180px;
        background-color: #eee;
        background-image: #{images.cadets_machine};
        background-fit: contain;
        background-opacity: 0;
        border-width: 0;
        color: #0A3A62;
        font-weight: bold;
        text-background-opacity: 0;
        text-outline-color: white;
        text-outline-width: 3; }

      node.machine:parent {
        background-image-opacity: 0;
        background-fit: none;
        background-height: 128px;
        background-width: 128px;
        background-opacity: 1;
        border-width: 2;
        min-height: 128px;
        min-width: 128px; }

      node.machine.external {
        text-margin-y: 0.25em;
        padding: 1em;
        background-image: #{images.machine_external};
        width: 135px;
        height: 135px; }

      node.pipe {
        content: data(label);
        background-color: #{colours.pipe};
        background-opacity: 0.25;
        border-color: #076928; }

      node.pipe-endpoint {
        content: '';
        font-size: 0;
        text-opacity: 0;
        shape: rectangle;
        background-image: #{images.pipe};
        background-color: white;
        background-opacity: 0;
        border-width: 0; }

      node.sock {
        background-color: #{colours.socket};
        background-opacity: 0.5;
        border-color: #999;
        border-opacity: 1; }

      node.socket-version {
        shape: rectangle;
        background-image: #{images.socket};
        background-fit: contain;
        background-opacity: 0;
        border-opacity: 0;
        font-size: 0;
        text-opacity: 0; }"
     ).update()
    ###


#
# Create a new graph.
#
exports.create = (container = null) ->
  new PvmGraph(container)
