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

neo4j = require('./neo4j.coffee')


#
# Connect to neo4j with some credentials (from GUI login or local storage)
#
login = (credentials) ->
  if credentials
    conn = neo4j.connect credentials, gui, (conn) -> gui.dbConnected conn


#
# Construct the GUI and pass in the available query functions:
#
gui = require './components/gui.marko'
  .renderSync { login: login }
  .appendTo document.getRootNode().body
  .getComponent()


#
# If we have viable Neo4j credentials, try to use them
#
storedCredentials = localStorage.getItem 'neo4jCredentials'
if storedCredentials
  credentials = JSON.parse(storedCredentials)
  gui.info "Connecting to #{credentials.uri} with stored credentials"
  login credentials
else
  gui.login()
