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


#
# Build some query functions, which will be replaced with more useful one
# after we've connected to the Neo4j database.
#
queries =
  processes: (filters, response) ->


#
# Connect to neo4j (if possible)
#
neo4j = require('./neo4j.coffee')

login = (credentials) ->
  if credentials
    db = neo4j.connect credentials, gui
    queries.processes = db.processes

storedCredentials = localStorage.getItem 'neo4jCredentials'
if storedCredentials
  gui.info "Connecting to #{storedCredentials.uri} with stored credentials"
  login storedCredentials


#
# Construct the GUI and pass in the available query functions:
#
gui = require './components/gui.marko'
  .renderSync { login: login, queries: queries }
  .appendTo document.getRootNode().body
  .getComponent()
