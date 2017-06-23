#! /usr/bin/env python

import argparse
import errno
import functools
import inspect
import json
import os
import sys

from flask import abort, Flask, g, json, jsonify, redirect, request, make_response, url_for
from neo4j.v1 import GraphDatabase, basic_auth
import neo4j.v1

if sys.version_info < (3,):
    import cgi

    def escape(str):
        return cgi.escape(str)
else:
    import html

    def escape(str):
        return html.escape(str)


app = Flask(__name__)


class OPUSJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, neo4j.v1.Node):
            data = {'id': o.id}
            if 'Socket' in o.labels:
                data.update({'type': "socket-version"})
                data.update(o.properties)
            elif 'Process' in o.labels:
                data.update({'type': "process",
                             'uuid': o['uuid'],
                             'host': o['host'],
                             'pid': o['pid'],
                             'username': o['meta_login'] if 'meta_login' in o else None,
                             'cmdline': o['cmdline'] if o['cmdline'] else None,
                             'last_update': o['meta_ts'],
                             'saw_creation': not o['anomalous']})
                data.update({k: o['meta_%s' % k] if ('meta_%s' % k) in o else None
                             for k in ['uid', 'euid', 'ruid', 'suid',
                                       'gid', 'egid', 'rgid', 'sgid']})
            elif 'Machine' in o.labels:
                data.update({'type': "machine",
                             'uuid': o['uuid'],
                             'ips': o['ips'],
                             'names': o['name'],
                             'first_seen': o['timestamp'],
                             'external': o['external']})
            elif 'Meta' in o.labels:
                data.update({'type': "process-meta"})
                data.update(o.properties)
            elif 'Conn' in o.labels:
                data.update({'type': "connection"})
                data.update(o.properties)
            else:
                data.update({'type': "file-version",
                             'uuid': o['uuid'],
                             'host': o['host'],
                             'names': o['name'],
                             'saw_creation': not o['anomalous']})
            return data
        elif isinstance(o, neo4j.v1.Relationship):
            type_map = {'PROC_PARENT': 'parent',
                        'PROC_OBJ': 'io',
                        'META_PREV': 'proc-metadata',
                        'PROC_OBJ_PREV': 'proc-change',
                        'GLOB_OBJ_PREV': 'file-change',
                        'COMM': 'comm'}
            state = o['state'] if 'state' in o else None
            if state is not None:
                if state == "NONE":
                    state = None
                elif state == "RaW":
                    state = ['READ', 'WRITE']
                elif state in ['CLIENT', 'SERVER']:
                    state = [state, 'READ', 'WRITE']
                elif state == "BIN":
                    state = [state, 'READ']
                else:
                    state = [state]
            return dict({'src': o.start,
                         'dest': o.end,
                         'id': o.id,
                         'type': type_map[o.type],
                         'state': state})
        else:
            return super(OPUSJSONEncoder, self).default(o)

app.json_encoder = OPUSJSONEncoder


def params_as_args(func):
    @functools.wraps(func)
    def wrap(*args, **kwargs):
        kwargs.update(request.args.to_dict())
        return func(*args, **kwargs)
    return wrap


def synth_route(route, **kwargs):
    def dec(func):
        @functools.wraps(func)
        def wrap(*wargs, **wkwargs):
            if app.config['synth'] is not None:
                arg_map = inspect.getcallargs(func, *wargs, **wkwargs)
                fname = "_".join([func.__name__] + [v for k, v in sorted(arg_map.items())]) + '.json'
                path = os.path.join(app.config['synth'], fname)
                if app.config['rec']:
                    ret = func(*wargs, **wkwargs)
                    with open(path, "w", encoding="UTF-8") as f:
                        f.write(json.dumps(dict(ret.headers.items())))
                        f.write("\n")
                        f.write(ret.data.decode("UTF-8"))
                    return ret
                else:
                    try:
                        with open(path, encoding="UTF-8") as f:
                            headers = json.loads(f.readline().rstrip())
                            body = f.read()
                        return make_response((body, headers))
                    except IOError:
                        return '', 500
            else:
                return func(*wargs, **wkwargs)
        return app.route(route, **kwargs)(params_as_args(wrap))
    return dec


@synth_route('/all')
def all_query():
    return jsonify({'nodes': [row['n'] for row in g.db.run("MATCH (n) RETURN n").data()],
                    'edges': [row['e'] for row in g.db.run("MATCH ()-[e]->() RETURN DISTINCT e").data()]})


@synth_route('/machines')
def machines_query():
    return jsonify({'nodes': [row['m']
                              for row in g.db.run("MATCH (m:Machine) RETURN m").data()],
                    'edges': [row['e']
                              for row in g.db.run("MATCH (:Machine)-[e]->(:Machine) RETURN DISTINCT e").data()]})


@synth_route('/neighbours/<uuid>')
def neighbours_query(uuid):
    res = g.db.run("""MATCH (s)-[e]-(d)
                      WHERE exists(s.uuid) AND s.uuid={uuid}
                      RETURN e, d""",
                   {'uuid': uuid}).data()
    return jsonify([{'node': row['d'],
                     'edge': row['e']}
                    for row in res])


@synth_route('/successors/<uuid>')
def successors_query(uuid, max_depth='4'):
    max_depth = int(max_depth)
    source = g.db.run("""MATCH (n)
                         WHERE exists(n.uuid) AND n.uuid={uuid}
                         RETURN n""",
                      {'uuid': uuid}).single()
    if source is None:
        abort(404)

    source = source['n']
    process = [(max_depth, source)]
    nodes = []
    while len(process):
        cur_depth, cur = process.pop()
        nodes.append(cur)
        neighbours = None
        if 'Global' in cur.labels:
            neighbours = g.db.run("""MATCH (cur:Global)-[e]->(n:Process)
                                     WHERE id(cur)={curid} AND e.state in ['BIN', 'READ', 'RaW', 'CLIENT', 'SERVER']
                                     RETURN n, e
                                     UNION
                                     MATCH (cur:Global)<-[e]-(n:Global)
                                     WHERE id(cur)={curid}
                                     RETURN n, e
                                     UNION
                                     MATCH (cur:Global)-[e]->(n:Conn)
                                     WHERE id(cur)={curid}
                                     RETURN n, e""",
                                  {'curid': cur.id}).data()
        elif 'Process' in cur.labels:
            neighbours = g.db.run("""MATCH (cur:Process)<-[e]-(n:Global)
                                     WHERE id(cur)={curid} AND e.state in ['WRITE', 'RaW', 'CLIENT', 'SERVER']
                                     RETURN n, e
                                     UNION
                                     MATCH (cur:Process)<-[e]-(n:Process)
                                     WHERE id(cur)={curid}
                                     RETURN n, e""",
                                  {'curid': cur.id}).data()
        elif 'Conn' in cur.labels:
            neighbours = g.db.run("""MATCH (cur:Conn)<-[e]-(n:Global)
                                     WHERE id(cur)={curid}
                                     RETURN n, e""",
                                  {'curid': cur.id}).data()
        if neighbours is None:
            continue
        for row in neighbours:
            if row['n'] in nodes:
                continue
            if cur_depth > 0:
                process.append((cur_depth - 1, row['n']))

    edata = g.db.run("""MATCH (a)-[e]-(b)
                        WHERE id(a) IN {ids} AND id(b) IN {ids}
                        RETURN DISTINCT e""",
                     {'ids': [n.id for n in nodes]}).data()

    edges = [row['e'] for row in edata]

    return jsonify({'root': source.id,
                    'nodes': nodes,
                    'edges': edges})


@app.route('/')
def root_redirect():
    return redirect(url_for("static", filename="index.html"))


@app.route("/old/proctree")
def old_proctree():
    return app.send_static_file("query-cache/proc_tree.json")


@app.route("/old/provgraph")
def old_provgraph():
    gnode_id = escape(request.args.get("gnode_id"))
    return app.send_static_file("query-cache/{}.json".format(gnode_id))


@app.route("/old/provdetail")
def old_provdetail():
    gnode_id = escape(request.args.get("gnode_id"))
    return app.send_static_file("query-cache/{}_files.json".format(gnode_id))


@app.route("/old/filegraph")
def old_filegraph():
    gnode_id = escape(request.args.get("gnode_id"))
    if os.path.exists("static/query-cache/{}.json".format(gnode_id)):
        return app.send_static_file("query-cache/{}.json".format(gnode_id))
    else:
        return jsonify({})


@app.route("/old/fwdgraph")
def old_fwdgraph():
    gnode_id = escape(request.args.get("gnode_id"))
    return app.send_static_file("query-cache/fwd-{}.json".format(gnode_id))


@app.route("/old/diffgraph")
def old_diffgraph():
    gnode_id1 = int(escape(request.args.get("gnode_id1")))
    gnode_id2 = int(escape(request.args.get("gnode_id2")))
    if gnode_id1 > gnode_id2:
        gnode_id1, gnode_id2 = gnode_id2, gnode_id1
    return app.send_static_file("query-cache/diff-{}-{}.json".format(gnode_id1, gnode_id2))


@app.before_request
def before_request():
    if 'db' in app.config:
        g.db = app.config['db'].session()


@app.teardown_request
def teardown_request(_):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--synth", default=None)
    parser.add_argument("--rec", action="store_true")
    parser.add_argument("--db-url", default="bolt://localhost")
    parser.add_argument("--db-user", default="neo4j")
    parser.add_argument("--db-pass", default="opus")
    return parser.parse_args()


def run(args):
    if args.rec or args.synth is None:
        app.config['db'] = GraphDatabase.driver(args.db_url,
                                                auth=basic_auth(args.db_user,
                                                                args.db_pass))
    if args.rec:
        if args.synth is None:
            print("Error: If recording you must specify a path for --synth")
            return
        else:
            if not os.path.exists(args.synth):
                try:
                    os.makedirs(args.synth)
                except OSError as exc:
                    if exc.errno == errno.EEXIST:
                        pass
                    else:
                        print("Error: --synth path invalid.")
                        return
    app.config['synth'] = args.synth
    app.config['rec'] = args.rec
    app.run(host=args.host,
            port=args.port)

if __name__ == "__main__":
    run(parse_args())
