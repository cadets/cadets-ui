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

neo4j = require('neo4j-driver/lib/browser/neo4j-web.min.js').v1

{FileVersion, Process} = require './pvm.coffee'


class Connection
  current_promise: null
  pvm_version: null

  constructor: (@driver, credentials, log = console.log, notifyConnected) ->
    @log = log
    @uri = credentials.uri
    self = this

    session = @driver.session()
    session.run('MATCH (n:DBInfo) RETURN n')
      .then (result) -> (
        if result.records.length == 0
          log.warn "
            Unable to interpret database at #{self.uri} —
            database contains no DBInfo node
          "

        else
          localStorage.setItem 'neo4jCredentials', JSON.stringify(credentials)

          self.pvm_version =
            parseInt result.records[0].get('n').properties.pvm_version

          log.info "Connected to #{self.uri} using PVM v#{self.pvm_version}"

          notifyConnected(this) if notifyConnected

        session.close()
      )
      .catch (err) ->
        session.close()
        log.warn err

  #
  # Look up file versions in the database according to a set of filters:
  #
  #   name        name substrings that have been used to refer to this file
  #   uuid        opaque UUID for the file
  #
  files: (filters, callback) =>
    session = @driver.session()
    session
      .run "
        MATCH (f:File)
        WHERE
          f.name CONTAINS '#{filters.name}'
          AND
          f.uuid CONTAINS '#{filters.uuid}'
        RETURN f
        LIMIT 100
      "
      .subscribe
        onNext: (record) ->
          callback new FileVersion(record.get 'f', @pvm_version)

        onCompleted: session.close()
        onError: @log.warn

  #
  # Look up processes in the database according to a set of filters:
  #
  #   cmdline     substring within the command line that executed the process
  #   uuid        opaque UUID for the process
  #
  processes: (filters, callback) =>
    session = @driver.session()
    session
      .run "
        MATCH (p:Process)
        WHERE
          p.cmdline CONTAINS '#{filters.cmdline}'
          AND
          p.uuid CONTAINS '#{filters.uuid}'
        RETURN p
        LIMIT 200
      "
      .subscribe
        onNext: (record) ->
          callback new Process(record.get 'p', @pvm_version)

        onCompleted: session.close()
        onError: @log.warn


module.exports =
  connect: (credentials, log, notifyConnected) ->
    {username, password, uri} = credentials
    if uri == null
      uri = 'bolt://localhost:7687'

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password))
    new Connection(driver, credentials, log, notifyConnected)
