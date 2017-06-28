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

import functools

import flask
import flask_bootstrap
import flask_dotenv
import opus
import nav

from flask import current_app

frontend = flask.Blueprint('frontend', __name__)


def params_as_args(func):
    @functools.wraps(func)
    def wrap(*args, **kwargs):
        kwargs.update(flask.request.args.to_dict())
        return func(*args, **kwargs)
    return wrap


@frontend.before_request
def before_request():
    current_app.db = current_app.db_driver.session()


@frontend.teardown_request
def teardown_request(_):
    current_app.db.close()


@frontend.route('/')
def index():
    return flask.render_template('index.html')


@frontend.route('/machine-view')
def machine_view():
    return flask.render_template('machine-view.html')


@frontend.route('/worksheet')
def worksheet():
    return flask.render_template('worksheet.html')


@frontend.route('/detail/<int:identifier>')
def get_detail(identifier):
    query = current_app.db.run('MATCH (n) WHERE id(n)={id} RETURN n',
                               {'id': identifier}).single()
    if query is None:
        flask.abort(404)
    return flask.jsonify(query['n'])


@frontend.route('/machines')
def get_machines():
    db = current_app.db
    nodes = [row['m'] for row in db.run("MATCH (m:Machine) RETURN m").data()]
    edges = [row['e'] for row in db.run(
        "MATCH (:Machine)-[e]->(:Machine) RETURN DISTINCT e").data()]

    return flask.jsonify({'nodes': nodes, 'edges': edges})


@frontend.route('/neighbours/<int:dbid>')
@params_as_args
def get_neighbours_id(dbid,
                      files=True,
                      sockets=True,
                      process_meta=True):

    matchers = {'Machine', 'Process'}
    if files != 'false':
        matchers.add('File')
    if sockets != 'false':
        matchers.add('Socket')
    if process_meta != 'false':
        matchers.add('Meta')

    res = current_app.db.run("""MATCH (s)-[e]-(d)
                                WHERE
                                    id(s)={id}
                                    AND
                                    any(lab in labels(d) WHERE lab IN {labs})
                                RETURN s, e, d""",
                             {'id': dbid,
                              'labs': list(matchers)}).data()
    root = {res[0]['s']} if len(res) else set()
    return flask.jsonify({'nodes': {row['d'] for row in res} | root,
                          'edges': {row['e'] for row in res}})


@frontend.route('/neighbours/<string:uuid>')
@params_as_args
def get_neighbours_uuid(uuid,
                        files=True,
                        sockets=True,
                        process_meta=True):
    matchers = {'Machine', 'Process'}
    if files != 'false':
        matchers.add('File')
    if sockets != 'false':
        matchers.add('Socket')
    if process_meta != 'false':
        matchers.add('Meta')

    res = current_app.db.run("""MATCH (s)-[e]-(d)
                                WHERE
                                    exists(s.uuid)
                                    AND
                                    s.uuid={uuid}
                                    AND
                                    any(lab in labels(d) WHERE lab IN {labs})
                                RETURN s, e, d""",
                             {'uuid': uuid,
                              'labs': list(matchers)}).data()
    root = {res[0]['s']} if len(res) else set()
    return flask.jsonify({'nodes': {row['d'] for row in res} | root,
                          'edges': {row['e'] for row in res}})


@frontend.route('/successors/<int:dbid>')
@params_as_args
def successors_query(dbid,
                     max_depth='4',
                     files=True,
                     sockets=True,
                     process_meta=True):
    max_depth = int(max_depth)
    if files != 'false':
        if sockets != 'false':
            glab = 'Global'
        else:
            glab = 'File'
    else:
        if sockets != 'false':
            glab = 'Socket'
        else:
            glab = None
    source = current_app.db.run("""MATCH (n)
                                   WHERE id(n)={dbid}
                                   RETURN n""",
                                {'dbid': dbid}).single()
    if source is None:
        flask.abort(404)

    source = source['n']
    process = [(max_depth, source)]
    nodes = []
    while len(process):
        cur_depth, cur = process.pop(0)
        nodes.append(cur)
        neighbours = None
        if 'Global' in cur.labels:
            neighbours = current_app.db.run("""MATCH (cur:Global)-[e]->(n:Process)
                                               WHERE
                                                   id(cur)={curid}
                                                   AND
                                                   e.state in ['BIN', 'READ', 'RaW', 'CLIENT', 'SERVER']
                                               RETURN n, e
                                               UNION
                                               MATCH (cur:Global)<-[e]-(n:Global)
                                               WHERE
                                                   id(cur)={curid}
                                                   AND
                                                   NOT {glab} is Null
                                                   AND
                                                   {glab} IN labels(n)
                                               RETURN n, e
                                               UNION
                                               MATCH (cur:Global)-[e]-(n:Conn)
                                               WHERE id(cur)={curid}
                                               RETURN n, e""",
                                            {'curid': cur.id,
                                             'glab': glab}).data()
        elif 'Process' in cur.labels:
            neighbours = current_app.db.run("""MATCH (cur:Process)<-[e]-(n:Global)
                                               WHERE
                                                   id(cur)={curid}
                                                   AND
                                                   e.state in ['WRITE', 'RaW', 'CLIENT', 'SERVER']
                                                   AND
                                                   NOT {glab} is Null
                                                   AND
                                                   {glab} IN labels(n)
                                               RETURN n, e
                                               UNION
                                               MATCH (cur:Process)<-[e]-(n:Process)
                                               WHERE id(cur)={curid}
                                               RETURN n, e""",
                                            {'curid': cur.id,
                                             'glab': glab}).data()
        elif 'Conn' in cur.labels:
            neighbours = current_app.db.run("""MATCH (cur:Conn)-[e]-(n:Global)
                                               WHERE
                                                   id(cur)={curid}
                                                   AND
                                                   NOT {glab} is Null
                                                   AND
                                                   {glab} IN labels(n)
                                               RETURN n, e""",
                                            {'curid': cur.id,
                                             'glab': glab}).data()
        if neighbours is None:
            continue
        for row in neighbours:
            if row['n'] in nodes or row['n'] in [n for d, n in process if d < (cur_depth - 1)]:
                continue
            if cur_depth > 0:
                process.append((cur_depth - 1, row['n']))

    edata = current_app.db.run("""MATCH (a)-[e]-(b)
                                  WHERE id(a) IN {ids} AND id(b) IN {ids}
                                  RETURN DISTINCT e""",
                               {'ids': [n.id for n in nodes]}).data()

    edges = [row['e'] for row in edata]

    return flask.jsonify({'nodes': nodes,
                          'edges': edges})


@frontend.route('/nodes')
@params_as_args
def get_nodes(node_type=None,
              name=None,
              host=None,
              local_ip=None,
              local_port=None,
              remote_ip=None,
              remote_port=None,
              limit='100'):
    if node_type not in opus.node_labels:
        lab = None
    else:
        lab = opus.node_labels[node_type]

    # TODO: do something with the 4-tuple parameters

    query = current_app.db.run("""MATCH (n)
                                  WHERE (
                                             {lab} is Null
                                             OR
                                             {lab} in labels(n)
                                        )
                                        AND
                                        (
                                             {name} is Null OR {name} = ''
                                             OR
                                             any(name in n.name WHERE name CONTAINS {name})
                                             OR
                                             n.cmdline CONTAINS {name}
                                        )
                                        AND
                                        (
                                            {host} is Null OR {host} = ''
                                            OR
                                            (
                                                exists(n.host)
                                                AND
                                                n.host = {host}
                                            )
                                        )
                                  RETURN n
                                  LIMIT {lmt}""",
                               {'lab': lab,
                                'lmt': int(limit),
                                'name': name,
                                'host': host})
    return flask.jsonify([row['n'] for row in query.data()])


nav.nav.register_element('frontend_top',
    nav.Navbar(
        nav.View('OPUS', '.index'),
        nav.View('Machines', '.machine_view'),
        nav.View('Worksheets', '.worksheet'),
    )
)


def create_app(db_driver):
    # See http://flask.pocoo.org/docs/patterns/appfactories
    app = flask.Flask(__name__)
    app.json_encoder = opus.OPUSJSONEncoder

    with app.app_context():
        current_app.db_driver = db_driver

        # Initialize UUID->machine_name mapping
        db = db_driver.session()
        query = db.run('''
            MATCH (m:Machine)
            WHERE exists(m.uuid)
            RETURN ID(m), m.uuid, m.name
        ''')
        current_app.machine_names = {}
        for row in query.data():
            opus.OPUSJSONEncoder.machines[row['m.uuid']] = (
                row['ID(m)'], row['m.name']
            )
        db.close()

    nav.nav.init_app(app)
    flask_dotenv.DotEnv().init_app(app, verbose_mode=True)

    flask_bootstrap.Bootstrap(app)
    app.register_blueprint(frontend)

    app.config['BOOTSTRAP_SERVE_LOCAL'] = True

    if app.debug:
        app.config['TEMPLATES_AUTO_RELOAD'] = True
        app.jinja_env.auto_reload = True

    return app
