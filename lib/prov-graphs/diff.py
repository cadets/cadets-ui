import json
import sys


def graph(g):
    nodes = {n['id']: {'id': n['id'],
                       'name': n['name'],
                       'type': n['type'],
                       'parents': []}
             for n in g['nodes']}
    root = nodes[g['root']]
    for edge in g['edges']:
        if edge['type'] == 'rw':
            nodes[edge['src']]['parents'].append(nodes[edge['dest']])
        nodes[edge['dest']]['parents'].append(nodes[edge['src']])
    return nodes, root


def diff(ga, gb):
    ga_n, ga_r = graph(ga)
    gb_n, gb_r = graph(gb)

    o_n_all, o_n_a, o_n_b, o_r = [], {}, {}, {'parents': [], 'chg': 'none'}

    o_n_a[ga_r['id']] = o_n_b[gb_r['id']] = o_r

    queue = [(ga_r, gb_r, o_r)]

    while len(queue):
        cur_a, cur_b, cur_o = queue.pop()

        o_n_all.append(cur_o)

        if cur_a is not None:
            cur_o['name'] = cur_a['name']
            cur_o['type'] = cur_a['type']
            cur_o['lid'] = cur_a['id']

            par_a = list(cur_a['parents'])
        else:
            par_a = []

        if cur_b is not None:
            cur_o['name'] = cur_b['name']
            cur_o['type'] = cur_b['type']
            cur_o['rid'] = cur_b['id']

            par_b = list(cur_b['parents'])
        else:
            par_b = []

        while len(par_a):
            p_a = par_a.pop()
            p_b_l = [p
                     for p in par_b
                     if p['type'] == p_a['type'] and
                     p['name'] == p_a['name']]

            if p_b_l:
                p_b = p_b_l[0]
                par_b.remove(p_b)

                if p_a['id'] in o_n_a:
                    p_o = o_n_a[p_a['id']]

                    if 'rid' not in p_o:
                        p_o['rid'] = p_b['id']
                        p_o['chg'] = 'none'
                        o_n_b[p_b['id']] = p_o
                elif p_b['id'] in o_n_b:
                    p_o = o_n_b[p_b['id']]

                    if 'lid' not in p_o:
                        p_o['lid'] = p_a['id']
                        p_o['chg'] = 'none'
                        o_n_a[p_a['id']] = p_o
                else:
                    p_o = {'parents': [], 'chg': 'none'}
                    o_n_a[p_a['id']] = p_o
                    o_n_b[p_b['id']] = p_o
                    queue.append((p_a, p_b, p_o))

                cur_o['parents'].append(p_o)
            else:
                if p_a['id'] in o_n_a:
                    p_o = o_n_a[p_a['id']]
                else:
                    p_o = {'parents': [], 'chg': 'del'}
                    o_n_a[p_a['id']] = p_o
                    queue.append((p_a, None, p_o))
                cur_o['parents'].append(p_o)

        for p_b in par_b:
            if p_b['id'] in o_n_b:
                p_o = o_n_b[p_b['id']]
            else:
                p_o = {'parents': [], 'chg': 'add'}
                o_n_b[p_b['id']] = p_o
                queue.append((None, p_b, p_o))
            cur_o['parents'].append(p_o)

    out_nodes = []
    out_nodes_l = {}
    out_nodes_r = {}

    for node in o_n_all:
        out_node = {'type': node['type'],
                    'name': node['name'],
                    'chg': node['chg']}

        nid = " - "
        if 'lid' in node:
            nid = str(node['lid']) + nid
            out_nodes_l[node['lid']] = out_node

        if 'rid' in node:
            nid = nid + str(node['rid'])
            out_nodes_r[node['rid']] = out_node
        out_node['id'] = nid
        out_nodes.append(out_node)

    out_e = []
    for edge in ga['edges']:
        src_n = out_nodes_l[edge['src']]
        dest_n = out_nodes_l[edge['dest']]
        out_e.append((src_n, dest_n, edge['type'], 'del'))

    for edge in gb['edges']:
        src_n = out_nodes_r[edge['src']]
        dest_n = out_nodes_r[edge['dest']]

        new_out = []
        found = False
        for s, d, t, c in out_e:
            if s == src_n and d == dest_n:
                new_out.append((s, d, t, 'none'))
                found = True
            else:
                new_out.append((s, d, t, c))
        if not found:
            new_out.append((src_n, dest_n, edge['type'], 'add'))
        out_e = new_out

    out_edges = [{'src': s['id'],
                  'dest': d['id'],
                  'type': t,
                  'chg': c}
                 for s, d, t, c in out_e]

    return {"root": out_nodes_l[ga['root']]['id'],
            "nodes": out_nodes,
            "edges": out_edges}

with open(sys.argv[1]) as g1_f:
    g1 = json.load(g1_f)

with open(sys.argv[2]) as g2_f:
    g2 = json.load(g2_f)

o = diff(g1, g2)

with open(sys.argv[3], "w") as o_f:
    json.dump(o, o_f)
# m = get_matching(nodify(g1), nodify(g2))
