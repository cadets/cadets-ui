# Copyright 2017 Jonathan Anderson
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import flask
import flask_bootstrap
import flask_dotenv
import json
import nav
import uuid

from flask import current_app

frontend = flask.Blueprint('frontend', __name__)


@frontend.route('/')
def index():
    return flask.render_template('index.html')


@frontend.route('/global')
def global_view():
    return flask.render_template('global-view.html')


@frontend.route('/worksheet')
def worksheet():
    return flask.render_template('worksheet.html')


@frontend.route('/everything')
def get_all():
    (nodes, edges) = current_app.graph_data
    return json.dumps(nodes.values() + edges.values())

@frontend.route('/detail/<int:identifier>')
def get_detail(identifier):
    (nodes, edges) = current_app.graph_data

    if identifier in nodes.keys():
        return json.dumps(nodes[identifier])

    elif identifier in edges.keys():
        return json.dumps(edges[identifier])

    else:
        raise ValueError, '%s not a valid node or event ID' % u


@frontend.route('/edges')
def get_edges():
    (nodes, edges) = current_app.graph_data
    return json.dumps(edges.values())

@frontend.route('/nodes')
def get_nodes():
    (nodes, edges) = current_app.graph_data
    return json.dumps(nodes.values())

@frontend.route('/onehop/<int:identifier>')
def get_element(identifier):
    (nodes, edges) = current_app.graph_data
    get_connections = current_app.query_connections

    return json.dumps(get_connections(identifier))


nav.nav.register_element('frontend_top',
    nav.Navbar(
        nav.View('OPUS', '.index'),
        nav.View('Global', '.global_view'),
        nav.View('Worksheets', '.worksheet'),
    )
)


def create_app(graph_data, query_connections):
    # See http://flask.pocoo.org/docs/patterns/appfactories
    app = flask.Flask(__name__)

    with app.app_context():
        current_app.graph_data = graph_data
        current_app.query_connections = query_connections

    nav.nav.init_app(app)
    flask_dotenv.DotEnv().init_app(app, verbose_mode = True)

    flask_bootstrap.Bootstrap(app)
    app.register_blueprint(frontend)

    app.config['BOOTSTRAP_SERVE_LOCAL'] = True

    if app.debug:
        app.config['TEMPLATES_AUTO_RELOAD'] = True
        app.jinja_env.auto_reload = True

    return app
