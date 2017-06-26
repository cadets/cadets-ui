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
import opus
import nav
import neo4j.v1

from flask import current_app

frontend = flask.Blueprint('frontend', __name__)


@frontend.before_request
def before_request():
    current_app.db = current_app.db_driver.session()

@frontend.teardown_request
def teardown_request(_):
    current_app.db.close()

def opus_json(data):
    return json.dumps(data, cls = opus.OPUSJSONEncoder)


@frontend.route('/')
def index():
    return flask.render_template('index.html')


@frontend.route('/global')
def global_view():
    return flask.render_template('global-view.html')


@frontend.route('/worksheet')
def worksheet():
    return flask.render_template('worksheet.html')


@frontend.route('/detail/<int:identifier>')
def get_detail(identifier):
    query = current_app.db.run('MATCH (n) WHERE ID(n)=%d RETURN n' % identifier)
    return opus_json(*query.single().values())


@frontend.route('/machines')
def get_machines():
    db = current_app.db
    nodes = [ row['m'] for row in db.run("MATCH (m:Machine) RETURN m").data() ]
    edges = [ row['e'] for row in db.run(
        "MATCH (:Machine)-[e]->(:Machine) RETURN DISTINCT e").data() ]

    return opus_json({ 'nodes': nodes, 'edges': edges })


@frontend.route('/onehop/<int:identifier>')
def get_onehop(identifier):
    query = current_app.db.run(
        '''
            MATCH (s)-[e]-(d)
            WHERE ID(s)={id} OR ID(d)={id}
            RETURN s, e, d
        ''',
        { 'id': identifier }
    )

    nodes = set()
    edges = set()

    for row in query.data():
        nodes.add(row['d'])
        edges.add(row['e'])

    return opus_json({ 'nodes': list(nodes), 'edges': list(edges) })


@frontend.route('/nodes')
def get_nodes():
    limit = flask.request.args.get('limit')
    limit = int(limit) if limit else 100

    query = current_app.db.run("MATCH (n) RETURN n LIMIT %d" % limit)

    return opus_json([ row['n'] for row in query.data() ])


nav.nav.register_element('frontend_top',
    nav.Navbar(
        nav.View('OPUS', '.index'),
        nav.View('Global', '.global_view'),
        nav.View('Worksheets', '.worksheet'),
    )
)


def create_app(db_driver):
    # See http://flask.pocoo.org/docs/patterns/appfactories
    app = flask.Flask(__name__)

    with app.app_context():
        current_app.db_driver = db_driver

    nav.nav.init_app(app)
    flask_dotenv.DotEnv().init_app(app, verbose_mode = True)

    flask_bootstrap.Bootstrap(app)
    app.register_blueprint(frontend)

    app.config['BOOTSTRAP_SERVE_LOCAL'] = True

    if app.debug:
        app.config['TEMPLATES_AUTO_RELOAD'] = True
        app.jinja_env.auto_reload = True

    return app
