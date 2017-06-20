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


def node(n):
    return {
        'data': dict([ (k,str(v)) for (k,v) in n.items() ]),
        'classes': n['type'],
    }

def edge(e):
    return {
        'data': dict([ (k,str(v)) for (k,v) in e.items() ]),
        'classes': e['type'],
    }

@frontend.route('/everything')
def get_all():
    if flask.current_app.debug:
        import mock_data

        nodes = mock_data.all_nodes
        events = mock_data.all_events

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps(
        [ node(n) for n in nodes ]
        + [ edge(e) for e in events ]
    )

@frontend.route('/edges')
def get_edges():
    if flask.current_app.debug:
        import mock_data

        events = mock_data.all_events

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps([ edge(e) for e in events ])

@frontend.route('/nodes')
def get_nodes():
    if flask.current_app.debug:
        import mock_data

        nodes = mock_data.all_nodes

    else:
        raise ValueError, 'not hooked up to real data yet'

    return json.dumps([ node(n) for n in nodes ])

@frontend.route('/onehop/<string:name>')
def get_element(name):
    if flask.current_app.debug:
        import mock_data

        node_map = mock_data.nodes
        event_map = mock_data.events

    else:
        raise ValueError, 'not hooked up to real data yet'

    u = uuid.UUID(name)

    nodes = []
    events = []

    if u in node_map.keys():
        n = node_map[u]

        nodes = [ n ]

        for e in n['in']:
            ev = event_map[e]
            nodes.append(node_map[ev['source']])
            events.append(ev)

        for e in n['out']:
            ev = event_map[e]
            nodes.append(node_map[ev['target']])
            events.append(ev)

    elif u in event_map.keys():
        ev = event_map[u]

        nodes = [
            node_map[ev['source']],
            node_map[ev['target']]
        ]
        events = [ ev ]

    else:
        raise ValueError, '%s not a valid node or event ID' % u

    return json.dumps(
        [ node(n) for n in nodes ]
        + [ edge(e) for e in events ]
    )


nav.nav.register_element('frontend_top',
    nav.Navbar(
        nav.View('OPUS', '.index'),
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

        from flaskext.sass import sass
        sass(app, input_dir = 'assets/sass', output_dir = 'static/style')

    return app
