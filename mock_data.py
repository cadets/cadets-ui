import collections
import dateutil.parser
import random
import time
import uuid

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


hosts = {}

count = 0

pids = random.sample(xrange(99999), 2000)

def date(s):
    d = dateutil.parser.parse(s)
    return time.mktime(d.timetuple())  # Python 3.3 has a timestamp() method...

def node(ty):
    global count
    count += 1

    return {
        'id': count,
        'type': ty,
    }

def machine(name, ips, first_seen, external = True):
    n = node('machine')
    n.update({
        'uuid': str(uuid.uuid4()),
        'names': [ name ],
        'ips': ips,
        'first_seen': first_seen,
        'external': external,
    })
    return n

def process(host, cmdline, timestamp, saw_creation = True, username = 'alice',
            **kwargs):
    '''
    Create a new process. Additional arguments may include:
     * [er][ug]id
     * last_update
    '''
    n = node('process')
    n.update({
        'host': host['uuid'],
        'parent': host['id'],
        'pid': pids[n['id']],
        'cmdline': cmdline,
        'username': username,
        'saw_creation': saw_creation,
    })
    for key in (
        'username', 'uid', 'euid', 'ruid', 'gid', 'egid', 'rgid', 'last_update'
        ):
        if key in kwargs:
            n[key] = kwargs[key]
        else:
            n[key] = None

    return n

def file_version(host, names):
    n = node('file-version')
    n.update({
        'host': host['uuid'],
        'parent': host['id'],
        'names': names,
    })
    return n

def run(parent, child):
    global count
    count += 1
    i = count

    sources[i].add(parent['id'])
    targets[parent['id']].add(i)

    targets[i].add(child['id'])
    sources[child['id']].add(i)

    return {
        'id': i,
        'type': 'parent',
        'source': parent['id'],
        'target': child['id'],
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


our_host = machine('cto', [ '192.168.1.100' ],
                   date('7 Jan 2017'), external = False)

attack_host = machine('lair', [ '192.168.10.100' ],
                      date('12 Feb 2017'), external = True)

dropbox = machine('dropbox', [ '99.99.99.99' ],
                  date('8 Jun 2017'), external = True)

for host in (our_host, attack_host, dropbox):
    hosts[host['uuid']] = host

chrome = process(our_host, 'chrome', date('12 Feb 2017 11:30 am'))
driveby = process(our_host, 'sh', date('12 Feb 2017 11:54 am'))
fetch_attack = process(our_host, 'fetch', date('12 Feb 2017 11:54 am'))
attack_sh = file_version(our_host, [ 'attack.sh', 'safe.conf' ])
run_attack = process(our_host, 'sh', date('12 Feb 2017 11:54 am'))
fetch_exfil = process(our_host, 'fetch', date('12 Feb 2017 11:54 am'))
exfil_sh = file_version(our_host, [ 'exfil.sh', 'innocuous.sh' ])
run_exfil = process(our_host, 'sh', date('12 Feb 2017 11:54 am'))
git_recon = process(our_host, 'git', date('12 Feb 2017 11:54 am'))
git_fetch = process(our_host, 'git', date('12 Feb 2017 11:54 am'))


all_nodes = (
    our_host,
    attack_host,
    dropbox,

    attack_sh,
    exfil_sh,

    chrome,
    driveby,
    fetch_attack,
    run_attack,
    fetch_exfil,
    run_exfil,
    git_recon,
    git_fetch,
)

nodes = dict([ (n['id'], n) for n in all_nodes ])

all_edges = [
    run(chrome, driveby),
    run(driveby, fetch_attack),
    flow(fetch_attack, attack_sh, { 'write': 2 }),
    run(driveby, run_attack),
    flow(attack_sh, run_attack, { 'mmap': 1 }, rw = "read write"),
    run(run_attack, fetch_exfil),
    flow(fetch_exfil, exfil_sh, { 'write': 3 }),
    run(run_attack, run_exfil),
    flow(exfil_sh, run_exfil, { 'mmap': 1 }, rw = "read write"),
    run(run_exfil, git_recon),
    run(run_exfil, git_fetch),
]

edges = dict([ (e['id'], e) for e in all_edges ])
