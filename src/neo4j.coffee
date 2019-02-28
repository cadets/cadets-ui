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

{pvm_parser} = require './pvm.coffee'


class Connection
  current_promise: null

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

          pvmver = parseInt result.records[0].get('n').properties.pvm_version
          log.info "Connected to #{self.uri} using PVM v#{pvmver}"

          if self.pvm = pvm_parser log, pvmver
            notifyConnected(self) if notifyConnected
          else
            log.error "Failed to build parser for PVM v#{pvmver}"

        session.close()
      )
      .catch (err) ->
        session.close()
        log.warn err

  #
  # Functions to build queries, possibly using user-provided filters:
  #

  #
  # Build a query to look up file versions that match a set of filters:
  #
  #   name        name substrings that have been used to refer to this file
  #   uuid        opaque UUID for the file
  #
  fileQuery: (filters) =>
    new Query @driver, @log, 'f', "
        MATCH (f:Store)
        WHERE
          f.uuid CONTAINS '#{filters.uuid}'
      ",
      @pvm.fileVersion

  #
  # Look up a node's immediate neighbours
  #
  neighbours: (node, filters) =>
    new Query @driver, @log, ['neighbour', 'edge'],
      "
        MATCH (n:Node)-[edge]-(neighbour:Node)
        WHERE id(n) = #{node.id}
      ",
      @pvm.parseNodeOrEdge

  #
  # Look up processes in the database according to a set of filters:
  #
  #   cmdline     substring within the command line that executed the process
  #   uuid        opaque UUID for the process
  #
  processQuery: (filters) =>
    new Query @driver, @log, 'p', "
      MATCH (p:Actor)
      WHERE
        p.ty = 'process'
        AND
        p.cmdline CONTAINS '#{filters.cmdline}'
        AND
        (#{filters.pid} = -1 OR p.pid = #{filters.pid})
        AND
        p.uuid CONTAINS '#{filters.uuid}'
      ",
      @pvm.process


#
# A query that can be executed and whose result set size can be reported in
# O(1) time.
#
class Query
  constructor: (@driver, @log, @varname, @matchExpr, @parse) ->

  #
  # Execute 
  #
  # Three callbacks should be provided:
  #
  #   total       called first, with a total number of nodes that match the
  #               filter query (although only a subset may actually be loaded)
  #   result      called with each node that arrives (in a stream of nodes)
  #   complete    called when transfer is complete
  #
  execute: (total, result, complete, limit = 200) =>
    countSession = @driver.session()
    countSession.run "#{@matchExpr} RETURN count(*) AS count"
      .then (result) ->
        count = result.records[0].get('count').low
        countSession.close()
        total count

    fullQuery = "#{@matchExpr} RETURN #{@varname} LIMIT #{limit}"
    @log.debug "Cypher: #{fullQuery}"

    session = @driver.session()
    self = this
    session
      .run fullQuery
      .subscribe
        onNext: (record) ->
          records = (self.parse(record.get v) for v in self.varname)
          result(records...)

        onCompleted: () ->
          session.close()
          complete()

        onError: (err) ->
          session.close()
          self.log.warn err


module.exports =
  connect: (credentials, log, notifyConnected) ->
    {username, password, uri} = credentials
    if uri == null
      uri = 'bolt://localhost:7687'

    config =
      encrypted: neo4j.ENCRYPTION_ON

    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), config)
    new Connection(driver, credentials, log, notifyConnected)
