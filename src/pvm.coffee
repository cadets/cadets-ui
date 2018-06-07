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
class @PvmEdge
  constructor: (record, pvm_version) ->
    @properties = record.properties

    @id = record.identity.low
    @source = record.start
    @dest = record.end

    switch @properties.class
      when 'read', 'write'
        @style_name = 'io'
        @label = @properties.class

      else
        @label = @properties.class


#
# Every PVM graph node has the following fields:
#
# @id::
#   a Neo4j database ID
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
class @PvmNode
  constructor: (@style_name, record) ->
    @id = record.identity.low
    @properties = record.properties
    @uuid = @properties.uuid
    @short_name = @uuid.substring(0, @uuid.indexOf('-'))


class @EditSession extends @PvmNode
  constructor: (record, pvm_version) ->
    super 'edit-session', record

    if @properties.name
      @label = @properties.name
    else
      @label = @uuid


class @FileVersion extends @PvmNode
  constructor: (record, pvm_version) ->
    super 'file-version', record

    if @properties.name
      @label = @properties.name
    else
      @label = @short_name


class @Process extends @PvmNode
  constructor: (record, pvm_version) ->
    super 'process', record

    @pid = @properties.pid.low

    @label = @properties.cmdline
    @short_name = @pid


class @Socket extends @PvmNode
  constructor: (record, pvm_version) ->
    super 'socket-version', record

    @label = @properties.uuid
