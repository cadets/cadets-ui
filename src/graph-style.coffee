# Copyright 2017-2018 Jonathan Anderson
# Copyright 2018 Garrett Kirkland
#
# Licensed under the Apache License, Version 2.0 (the "License")
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

colours =
  file: '#dc9'
  important: 'orange'
  io: '#6c3'
  parent: '#366'
  pipe: '#076928'
  socket: '#999'
  text: 'black'

module.exports = [
  {
    selector: 'core',
    style:
      'active-bg-color': '#7a7a7a'
  },
  
  {
    selector: 'node',
    style:
      content: 'data(label)'
      color: colours.text
      'font-family': 'Inconsolata, Source Code Pro, Consolas, monospace'
      'border-style': 'solid'
      'border-width': 2
      'text-outline-color': '#eee'
      'text-outline-opacity': '0.9'
      'text-outline-width': 0
      'text-halign': 'center'
      'text-valign': 'bottom'
      'text-wrap': 'wrap'
      'text-max-width': '8em'
      'height': '4em'
      'width': '4em'
      'background-fit': 'contain'
      'background-position-x': 0
      'background-position-y': 0
  },

  #
  # Selected, active and flagged ("important") nodes:
  #
  {
    selector: 'node:selected'
    style:
      'overlay-color': '#720d00'
      'overlay-opacity': 0.5
      'overlay-padding': 5
  },
  {
    selector: 'node:active'
    style:
      'overlay-color': '#474747'
      'overlay-opacity': 0.5
      'overlay-padding': 5
  },
  {
    selector: 'node.important'
    style:
      'overlay-color': colours.important
      'overlay-padding': 64
      'overlay-opacity': 0.50
  }

  #
  # Various types of PVM nodes:
  #

  {
    selector: 'node.ptty'
    style:
      shape: 'rectangle'
      'text-opacity': 0
      'background-image': require './img/ptty.png'
      'background-opacity': 0
      'border-width': 0
  },
  {
    selector: 'node.connection'
    style:
      shape: 'rectangle'
      'background-image': require './img/connection.png'
      'background-opacity': 0
      'border-opacity': 0
  },
  {
    selector: 'node.edit-session'
    style:
      shape: 'rectangle'
      'text-opacity': 0
      'background-image': require './img/edit-session.png'
      'background-opacity': 0
      'border-width': 0
  },
  {
    selector: 'node.file',
    style:
      'background-color': colours.file
      'background-opacity': 0.25
      'border-color': '#633'
  },

  {
    selector: 'node.file-version'
    style:
      shape: 'rectangle'
      'background-image': require './img/file-version.png'
      'background-opacity': 0
      'border-width': 0
  },

  {
    selector: 'node.pipe'
    style:
      shape: 'rectangle'
      'font-size': 0
      'text-opacity': 0
      'background-image': require './img/pipe.png'
      'background-color': 'white'
      'background-opacity': 0
      'border-width': 0
  },

  {
    selector: 'node.process',
    style:
      shape: 'ellipse'

      'background-image': require './img/proc.png'
      'background-opacity': 0
      'border-opacity': 0
  },

  {
    selector: 'node.socket'
    style:
      'background-color': colours.socket
      'background-opacity': 0.5
      'border-color': '#999'
      'border-opacity': 1
  },

  {
    selector: 'node.socket-version'
    style:
      shape: 'rectangle'
      'background-image': require './img/socket.png'
      'background-fit': 'contain'
      'background-opacity': 0
      'border-opacity': 0
      'font-size': 0
      'text-opacity': 0
  },

      ###
      node.machine {
        font-size: 48pt
        text-valign: top
        shape: rectangle
        padding: 4em
        width: 180px
        height: 180px
        background-color: #eee
        background-image: require './img/cadets-machine.svg'
        background-fit: contain
        background-opacity: 0
        border-width: 0
        color: #0A3A62
        font-weight: bold
        text-background-opacity: 0
        text-outline-color: white
        text-outline-width: 3; }

      node.machine:parent {
        background-image-opacity: 0
        background-fit: none
        background-height: 128px
        background-width: 128px
        background-opacity: 1
        border-width: 2
        min-height: 128px
        min-width: 128px; }

      node.machine.external {
        text-margin-y: 0.25em
        padding: 1em
        background-image: require './img/machine-external.svg'
        width: 135px
        height: 135px; }

      node.pipe {
        content: data(label)
        background-color: #{colours.pipe}
        background-opacity: 0.25
        border-color: #076928; }
    ###

  {
    selector: 'edge'
    style:
      'curve-style': 'bezier'
      'width': 2

      'arrow-scale': 2
      'mid-target-arrow-shape': 'triangle'
      'source-arrow-shape': 'none'

      'content': 'data(label)'
      'color': 'white'
      'font-family': 'Avenir, Helvetica Neue, Helvetica, sans-serif'
      'text-halign': 'center'
      'text-valign': 'center'
      'text-outline-width': 1
  },

  {
    selector: 'edge.io'
    style:
      'mid-target-arrow-shape': 'none'
      'target-arrow-shape': 'triangle'
      'target-arrow-color': colours.io
      'line-color': colours.io
      'line-style': 'dotted'
      'target-arrow-color': colours.io
      'text-outline-color': colours.io
  },

  {
    selector: 'edge.child'
    style:
      'line-style': 'dotted'
      'width': 8
      'target-arrow-color': colours.parent
      'mid-target-arrow-color': colours.parent
      'line-color': colours.parent
      'text-outline-color': colours.parent
  },

    ###
      edge.file-change {
        line-style: dotted
        target-arrow-color: #633
        mid-target-arrow-color: #633
        line-color: #633
        text-outline-color: #633; }

      edge.comm {
        line-style: dashed
        target-arrow-color: #633
        mid-target-arrow-color: #633
        line-color: #633
         text-outline-color: #633; }

      edge.proc-change {
        line-style: dashed
        target-arrow-color: #366
        mid-target-arrow-color: #366
        line-color: #366
        text-outline-color: #366; }

      edge.proc-metadata {
        line-style: dotted
        target-arrow-color: #366
        mid-target-arrow-color: #366
        line-color: #366
        text-outline-color: #366; }

      edge.inf {
        line-style: dotted
        target-arrow-color: #633
        mid-target-arrow-color: #633
        line-color: #633
        text-outline-color: #633; }

      edge.describes {
        target-arrow-color: #8c4a00
        mid-target-arrow-color: #8c4a00
        line-color: #8c4a00
        text-outline-color: #8c4a00; }
     ).update()
    ###
]
