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
    if flask.current_app.debug:
        import mock_data

        nodes = mock_data.nodes
        edges = mock_data.edges

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps(nodes.values() + edges.values())

@frontend.route('/detail/<int:identifier>')
def get_detail(identifier):
    if flask.current_app.debug:
        import mock_data

        node_map = mock_data.nodes
        edge_map = mock_data.edges

    else:
        raise ValueError, 'not hooked up to real data yet'

    if identifier in node_map.keys():
        return json.dumps(node_map[identifier])

    elif identifier in edge_map.keys():
        return json.dumps(edge_map[identifier])

    else:
        raise ValueError, '%s not a valid node or event ID' % u


@frontend.route('/edges')
def get_edges():
    if flask.current_app.debug:
        import mock_data

        edges = mock_data.edges

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps(edges.values())

@frontend.route('/nodes')
def get_nodes():
    if flask.current_app.debug:
        import mock_data

        nodes = mock_data.nodes

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps(nodes.values())

@frontend.route('/onehop/<int:identifier>')
def get_element(identifier):
    if flask.current_app.debug:
        import mock_data

        node_map = mock_data.nodes
        edge_map = mock_data.edges
        get_connections = mock_data.get_connections

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps(get_connections(identifier))


nav.nav.register_element('frontend_top',
    nav.Navbar(
        nav.View('OPUS', '.index'),
        nav.View('Global', '.global_view'),
        nav.View('Worksheets', '.worksheet'),
    )
)


def create_app():
    # See http://flask.pocoo.org/docs/patterns/appfactories
    app = flask.Flask(__name__)

    nav.nav.init_app(app)
    flask_dotenv.DotEnv().init_app(app, verbose_mode = True)

    flask_bootstrap.Bootstrap(app)
    app.register_blueprint(frontend)

    app.config['BOOTSTRAP_SERVE_LOCAL'] = True

    if app.debug:
        app.config['TEMPLATES_AUTO_RELOAD'] = True
        app.jinja_env.auto_reload = True

    return app
