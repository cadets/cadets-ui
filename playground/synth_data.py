import collections
import json


def load(f):
    raw_data = json.load(f)
    (nodes, edges) = (raw_data['nodes'], raw_data['edges'])

    return ((nodes, edges), None)

# Sources and targets: (node id) -> set(node ids)
sources = collections.defaultdict(set)
targets = collections.defaultdict(set)


def get_connections(identifier):
    global source, targets, nodes, edges

    (n, e) = (set([ identifier ]), set())

    for i in sources[identifier]:
        e.add(i)
        n.add(edges[i]['source'])

    for i in targets[identifier]:
        e.add(i)
        n.add(edges[i]['target'])

    return {
        'nodes': [ nodes[i] for i in n ],
        'edges': [ edges[i] for i in e ],
    }


def flow(source, dest, actions = {}, rw = None):
    global count
    count += 1
    i = count

    sources[i].add(source['id'])
    targets[source['id']].add(i)

    targets[i].add(dest['id'])
    sources[dest['id']].add(i)

    return {
        'id': i,
        'type': 'io',
        'source': source['id'],
        'target': dest['id'],
    }
