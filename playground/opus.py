import json
import neo4j.v1

class OPUSJSONEncoder(json.JSONEncoder):
    machines = {}

    def __init__(self, *args, **kwargs):
        super(OPUSJSONEncoder, self).__init__(*args, **kwargs)

    def default(self, o):
        if isinstance(o, neo4j.v1.Node):
            data = {'id': o.id}
            if 'Socket' in o.labels:
                data.update({'type': "socket-version"})
                data.update({'names': o['name']})
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

            if 'host' in o:
                (i, name) = self.machines[o['host']]
                data.update({ 'hostname': name, 'parent': i })

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
            return dict({'source': o.start,
                         'target': o.end,
                         'id': int(o.id),
                         'type': type_map[o.type],
                         'state': state})
        else:
            return super(OPUSJSONEncoder, self).default(o)

