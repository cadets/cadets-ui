import uuid

def node(ty):
    return {
        'id': uuid.uuid4(),
        'type': ty,
        'in': set(),
        'out': set(),
    }

def process(execname):
    n = node('process')
    n.update({
        'icon': 'settings_applications',
        'label': execname,
        'execname': execname,
    })
    return n

def vnode():
    n = node('vnode')
    u = n['id']
    n.update({
        'icon': 'description',
        'label': u.hex[:7],
    })
    return n

def run(parent, child):
    u = uuid.uuid4()

    parent['out'].add(u)
    child['in'].add(u)

    return {
        'id': u,
        'label': '',
        'icon': 'exit_to_app',
        'type': 'exec',
        'source': parent['id'],
        'target': child['id'],
    }

def syscall(name, source, dest):
    u = uuid.uuid4()

    source['out'].add(u)
    dest['in'].add(u)

    return {
        'id': u,
        'label': name,
        'icon': 'get_app',
        'type': 'syscall',
        'source': source['id'],
        'target': dest['id'],
    }


chrome = process('chrome')
driveby = process('sh')
fetch_attack = process('fetch')
attack_sh = vnode()
run_attack = process('sh')
fetch_exfil = process('fetch')
exfil_sh = vnode()
run_exfil = process('sh')
git_recon = process('git')
git_fetch = process('git')


all_nodes = (
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

all_events = [
    run(chrome, driveby),
    run(driveby, fetch_attack),
    syscall('write', fetch_attack, attack_sh),
    run(driveby, run_attack),
    syscall('mmap', attack_sh, run_attack),
    run(run_attack, fetch_exfil),
    syscall('write', fetch_exfil, exfil_sh),
    run(run_attack, run_exfil),
    syscall('mmap', exfil_sh, run_exfil),
    run(run_exfil, git_recon),
    run(run_exfil, git_fetch),
]

events = dict([ (e['id'], e) for e in all_events ])
