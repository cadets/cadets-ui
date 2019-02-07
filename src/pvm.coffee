# Copyright 2018 Jonathan Anderson
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


#
# A Neo4j node or edge
#
class GraphEntity
  constructor: (record) ->
    @id = record.identity.low
    @properties = record.properties


#
# Every PVM graph edge has the following fields:
#
# @id::
#   Neo4j database ID
#
# @source::
#   Database ID of the originating node
#
# @dest::
#   Databaes ID of the terminating node
#
# @style_name::
#   A CSS-friendly name for the edge type
#
class PvmEdge extends GraphEntity
  constructor: (record) ->
    super record

    @source = record.start.low
    @dest = record.end.low

    c = @properties.class
    @label = c

    switch c
      when 'read', 'write'
        @style_name = 'io ' + c

      when 'child'
        @style_name = 'child'    # TODO: fork? exec?



#
# Every PVM graph node has the following fields:
#
# @id::
#   a unique ID that will be the primary ID for the graph node
#
# @label::
#   a longer human-readable string for display in lists and graph
#   (e.g., a file path or a process' command line)
#
# @short_name::
#   a name that is short and ideally human-meaningful, but which is not
#   necessarily unique
#
# @style_name::
#   used by graphing code to look up, e.g., icons
#
# @properties::
#   a set of raw named properties from the database — these can be presented
#   to the user for interpretation but are not necessarily interpreted by the
#   UI itself
#
# In addition to these, subclasses of PvmNode add fields that are relevant to
# the type. For example, Process objects have a @pid (process ID) field.
#
class PvmNode extends GraphEntity
  constructor: (@style_name, record) ->
    super record

    @uuid = @properties.uuid
    @short_name = @uuid.substring(0, @uuid.indexOf('-'))


class EditSession extends PvmNode
  constructor: (record) ->
    super 'edit-session', record

    if @properties.name
      @label = @properties.name
    else
      @label = @uuid


class FileVersion extends PvmNode
  constructor: (record) ->
    super 'file-version', record

    if @properties.name
      @label = @properties.name
    else
      @label = @short_name


class Process extends PvmNode
  constructor: (record) ->
    super 'process', record

    @pid = @properties.pid.low

    @label = @properties.cmdline
    @short_name = @pid


class Socket extends PvmNode
  constructor: (record) ->
    super 'socket-version', record

    @label = @properties.uuid



#
# A Path node can be referenced by `NAMED` edges.
#
class Path extends GraphEntity
  constructor: (record) ->
    super record

    @path = @properties.path


#
# A parser for PVMv2 nodes and edges
#
class PVMv2Parser
  constructor: (@log) ->

  #
  # Parse a record that may be a node or an edge
  #
  parseNodeOrEdge: (record) =>
    if record.start?
      @parseEdge record
    else
      @parseNode record

  #
  # Parse a PVM edge
  #
  parseEdge: (record) =>
    new PvmEdge record

  #
  # Parse a Node of unknown type
  #
  parseNode: (record) =>
    labels = record.labels

    # TODO: are the labels guaranteed to be ['Node', 'TheThingWeWant']?
    nodeIndex = labels.indexOf 'Node'
    labels.splice nodeIndex, 1

    ty = record.properties.ty

    if labels[0] == 'Path' or labels[0] == 'Name'
      return new Path record

    else if ty == 'process'
      return new Process record

    else if ty == 'socket'
      return new Socket record

    else if labels[0] == 'EditSession'
      return new EditSession record

    else if ty == 'file'
      return new FileVersion record

    @log.info 'Unhandled node type ' + labels[0] + ': ' + record

  #
  # Parse a (known) FileVersion
  #
  fileVersion: (record) =>
    return new FileVersion record

  #
  # Parse a (known) Process
  #
  process: (record) =>
    return new Process record


#
# Choose a PVM parser
#
exports.pvm_parser = (log, pvm_version) ->
  # We currently only support v2
  if pvm_version == 2
    return new PVMv2Parser log

  log.warn "Unsupported PVM version: #{pvm_version}"
