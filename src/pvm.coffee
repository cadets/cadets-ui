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


class @PvmNode
  constructor: (@version) ->


class @Process extends @PvmNode
  constructor: (record, pvm_version) ->
    super pvm_version

    @properties = record.properties

    @dbid = @properties.db_id.low
    @label = @properties.cmdline
    @pid = @properties.pid.low
    @uuid = @properties.uuid

    @style = 'process'
