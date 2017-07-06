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


@frontend.route('/alerts')
def alerts_view():
    return flask.render_template('alerts.html')


@frontend.route('/alert-data')
def alert_data():

    return flask.jsonify()


@frontend.route('/detail/<int:identifier>')
def get_detail_id(identifier):
    query = current_app.db.run('MATCH (n) WHERE id(n)={id} RETURN n',
                               {'id': identifier}).single()
    if query is None:
        flask.abort(404)
    return flask.jsonify(query['n'])


@frontend.route('/detail/<string:uuid>')
def get_detail_uuid(**kwargs):
    query = current_app.db.run(
            'MATCH (n) WHERE exists(n.uuid) AND n.uuid={uuid} RETURN n',
            kwargs).single()
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
                      pipes=True,
                      process_meta=True):
    matchers = {'Machine', 'Process', 'Conn'}
    if files != 'false':
        matchers.add('File')
    if sockets != 'false':
        matchers.add('Socket')
    if pipes != 'false':
        matchers.add('Pipe')
    if files != 'false' and sockets != 'false' and pipes != 'false':
        matchers.add('Global')
    if process_meta != 'false':
        matchers.add('Meta')

    neighbours = current_app.db.run("""MATCH (s)-[e]-(d)
                                       WHERE
                                           id(s)={id}
                                           AND NOT
                                           (
                                               "Machine" in labels(s)
                                               AND
                                               "Machine" in labels(d)
                                           )
                                           AND
                                           (
                                               NOT d:Pipe
                                               OR
                                               d.fds <> []
                                           )
                                           AND
                                           any(lab in labels(d) WHERE lab IN {labs})
                                       RETURN s, e, d""",
                                    {'id': dbid,
                                     'labs': list(matchers)}).data()
    root = {neighbours[0]['s']} if len(neighbours) else set()
    if sockets != "false":
        m_qry = current_app.db.run("""MATCH (skt:Socket), (mch:Machine)
                                      WHERE
                                          mch.external
                                          AND
                                          id(skt)={srcid}
                                          AND
                                          split(skt.name[0], ":")[0] in mch.ips
                                      RETURN skt, mch
                                      UNION
                                      MATCH (skt:Socket), (mch:Machine)
                                      WHERE
                                          mch.external
                                          AND
                                          id(mch)={srcid}
                                          AND
                                          split(skt.name[0], ":")[0] in mch.ips
                                      RETURN skt, mch""",
                                   {'srcid': dbid}).data()
        m_links = [{'id': row['skt'].id + row['mch'].id,
                    'source': row['skt'].id,
                    'target': row['mch'].id,
                    'type': 'comm',
                    'state': None}
                   for row in m_qry]
        m_nodes = {row['mch'] for row in m_qry} | {row['skt'] for row in m_qry}
    else:
        m_links = []
        m_nodes = set()
    return flask.jsonify({'nodes': {row['d'] for row in neighbours} | m_nodes | root,
                          'edges': list({row['e'] for row in neighbours}) + m_links})


@frontend.route('/neighbours/<string:uuid>')
@params_as_args
def get_neighbours_uuid(uuid,
                        files=True,
                        sockets=True,
                        pipes=True,
                        process_meta=True):
    matchers = {'Machine', 'Process', 'Conn'}
    if files != 'false':
        matchers.add('File')
    if sockets != 'false':
        matchers.add('Socket')
    if pipes != 'false':
        matchers.add('Pipe')
    if files != 'false' and sockets != 'false' and pipes != 'false':
        matchers.add('Global')
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
                     pipes=True,
                     process_meta=True):
    max_depth = int(max_depth)
    matchers = set()
    if files != 'false':
        matchers.add('File')
    if sockets != 'false':
        matchers.add('Socket')
    if pipes != 'false':
        matchers.add('Pipe')
    if files != 'false' and sockets != 'false' and pipes != 'false':
        matchers.add('Global')
    matchers = list(matchers)
    if files == 'false' and sockets == 'false' and pipes == 'false':
        matchers = None
    print(matchers)
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
                                                   (
                                                       NOT n:Pipe
                                                       OR
                                                       n.fds <> []
                                                   )
                                                   AND
                                                   NOT {glabs} is Null
                                                   AND
                                                   any(lab in labels(n) WHERE lab IN {glabs})
                                               RETURN n, e
                                               UNION
                                               MATCH (cur:Global)-[e]-(n:Conn)
                                               WHERE id(cur)={curid}
                                               RETURN n, e""",
                                            {'curid': cur.id,
                                             'glabs': matchers}).data()
        elif 'Process' in cur.labels:
            neighbours = current_app.db.run("""MATCH (cur:Process)<-[e]-(n:Global)
                                               WHERE
                                                   id(cur)={curid}
                                                   AND
                                                   e.state in ['WRITE', 'RaW', 'CLIENT', 'SERVER']
                                                   AND
                                                   (
                                                       NOT n:Pipe
                                                       OR
                                                       n.fds <> []
                                                   )
                                                   AND
                                                   NOT {glabs} is Null
                                                   AND
                                                   any(lab in labels(n) WHERE lab IN {glabs})
                                               RETURN n, e
                                               UNION
                                               MATCH (cur:Process)<-[e]-(n:Process)
                                               WHERE id(cur)={curid}
                                               RETURN n, e""",
                                            {'curid': cur.id,
                                             'glabs': matchers}).data()
        elif 'Conn' in cur.labels:
            neighbours = current_app.db.run("""MATCH (cur:Conn)-[e]-(n:Global)
                                               WHERE
                                                   id(cur)={curid}
                                                   AND
                                                   (
                                                       NOT n:Pipe
                                                       OR
                                                       n.fds <> []
                                                   )
                                                   AND
                                                   NOT {glabs} is Null
                                                   AND
                                                   any(lab in labels(n) WHERE lab IN {glabs})
                                               RETURN n, e""",
                                            {'curid': cur.id,
                                             'glabs': matchers}).data()
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
    if local_ip is None or local_ip == "":
        local_ip = ".*?"
    if local_port is None or local_port == "":
        local_port = ".*?"
    if remote_ip is None or remote_ip == "":
        remote_ip = ".*?"
    if remote_port is None or remote_port == "":
        remote_port = ".*?"

    query = current_app.db.run("""MATCH (n)
                                  WHERE 
                                      {lab} is Null
                                      OR
                                      {lab} in labels(n)
                                  WITH n
                                  WHERE
                                      {name} is Null
                                      OR
                                      {name} = ''
                                      OR
                                      any(name in n.name WHERE name CONTAINS {name})
                                      OR
                                      n.cmdline CONTAINS {name}
                                  WITH n
                                  WHERE
                                      {host} is Null
                                      OR
                                      {host} = ''
                                      OR
                                      (
                                          exists(n.host)
                                          AND
                                          n.host = {host}
                                      )
                                      OR
                                      n.uuid = {host}
                                  WITH n
                                  MATCH (m:Machine)
                                  WHERE
                                      (
                                          n:Conn
                                          AND
                                          (
                                              n.client_ip=~{local_ip}
                                              OR
                                              n.server_ip=~{local_ip}
                                              OR
                                              (
                                                  n.type = 'Pipe'
                                                  AND
                                                  {local_ip} = '.*?'
                                              )
                                          )
                                          AND
                                          (
                                              n.client_port=~{local_port}
                                              OR
                                              n.server_port=~{local_port}
                                              OR
                                              (
                                                  n.type = 'Pipe'
                                                  AND
                                                  {local_port} = '.*?'
                                              )
                                          )
                                          AND
                                          (
                                              n.server_ip=~{remote_ip}
                                              OR
                                              n.client_ip=~{remote_ip}
                                              OR
                                              (
                                                  n.type = 'Pipe'
                                                  AND
                                                  {remote_ip} = '.*?'
                                              )
                                          )
                                          AND
                                          (
                                              n.server_port=~{remote_port}
                                              OR
                                              n.client_port=~{remote_port}
                                              OR
                                              (
                                                  n.type = 'Pipe'
                                                  AND
                                                  {remote_port} = '.*?'
                                              )
                                          )
                                      )
                                      OR
                                      (
                                          NOT n:Conn
                                          AND
                                          (
                                              NOT n:Socket
                                              OR
                                              (
                                                  n:Socket
                                                  AND
                                                  any(name in n.name
                                                      WHERE name =~ ({remote_ip}+':?'+{remote_port}))
                                                  AND
                                                  (
                                                      {local_ip} = ".*?"
                                                      OR
                                                      (
                                                          m.uuid = n.host
                                                          AND
                                                          any(l_ip in m.ips
                                                              WHERE l_ip = {local_ip})                                                 
                                                      )
                                                  )
                                              )
                                          )
                                      )
                                RETURN DISTINCT n
                                LIMIT {lmt}""",
                               {'lab': lab,
                                'lmt': int(limit),
                                'name': name,
                                'host': host,
                                'local_ip': local_ip,
                                'local_port': local_port,
                                'remote_ip': remote_ip,
                                'remote_port': remote_port})
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
