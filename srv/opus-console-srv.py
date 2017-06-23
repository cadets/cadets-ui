#! /usr/bin/env python

import argparse
import errno
import functools
import json
import os
import sys

from flask import Flask, g, jsonify, redirect, request, make_response, url_for
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
            if 'Socket' in o.labels:
                ntype = "socket"
                dname = ", ".join(o['name'])
            elif 'Process' in o.labels:
                ntype = "process"
                dname = o['cmdline']
            elif 'Machine' in o.labels:
                ntype = "machine"
                if len(o['name']):
                    dname = ", ".join(o['name'])
                else:
                    dname = ", ".join(o['ips'])
            elif 'Meta' in o.labels:
                ntype = 'process-meta'
                dname = "meta"
            elif 'Conn' in o.labels:
                ntype = 'conn'
                dname = "conn"
            else:
                ntype = 'file-version'
                dname = ", ".join(o['name'])
            return dict({'id': o.id,
                         'type': ntype,
                         'display_name': dname},
                        **o.properties)
        elif isinstance(o, neo4j.v1.Relationship):
            return dict({'src': o.start,
                         'dest': o.end,
                         'id': o.id,
                         'type': o.type},
                        **o.properties)
        else:
            return super(OPUSJSONEncoder, self).default(o)

app.json_encoder = OPUSJSONEncoder


def synth_route(route, **kwargs):
    def dec(func):
        @functools.wraps(func)
        def wrap(*wargs, **wkwargs):
            if app.config['synth'] is not None:
                fname = "_".join([func.__name__] + [v for k, v in sorted(wkwargs.items())]) + '.json'
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
        return app.route(route, **kwargs)(wrap)
    return dec


@synth_route('/all')
def all_query():
    return jsonify({'nodes': [row['n'] for row in g.db.run("MATCH (n) RETURN n").data()],
                    'edges': [row['e'] for row in g.db.run("MATCH ()-[e]->() RETURN DISTINCT e").data()]})


@synth_route('/machines')
def machines_query():
    res = g.db.run("MATCH (m:Machine) RETURN m").data()
    nodes = [{'uuid': m['m']['uuid'],
              'first_seen': m['m']['timestamp'],
              'type': 'machine',
              'name': m['m']['uuid'],
              'id': m['m'].id}
             for m in res]

    res = g.db.run("MATCH (m1:Machine)-->(m2:Machine) RETURN DISTINCT m1, m2").data()
    edges = [{'src': row['m1'].id,
              'dest': row['m2'].id,
              'type': 'conn'}
             for row in res]

    root = nodes[0]['id'] if len(nodes) else 0
    return jsonify({'root': root, 'nodes': nodes, 'edges': edges})


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
