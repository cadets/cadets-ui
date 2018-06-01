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
# Construct a new PVM graph node.
#
# Every graph node has the following fields:
#
# @dbid::
#   a Neo4j database ID
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
  constructor: (@style_name, @properties) ->
    @short_name = '<unknown>'
    @dbid = @properties.db_id


class @Process extends @PvmNode
  constructor: (record, pvm_version) ->
    super 'process', record.properties

    @properties = record.properties

    @pid = @properties.pid.low
    @uuid = @properties.uuid

    @label = @properties.cmdline
    @short_name = @pid
    @style = 'process'