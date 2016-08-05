
from __future__ import (absolute_import, division,
                        print_function, unicode_literals)
from neo4j import GraphDatabase, Evaluation, INCOMING

import datetime
import threading
from opus import storage
import sys
import datetime
import json

proc_map = {}

user_map = {}
user_map['8314'] = {'name': 'bob', 'IP': '192.168.1.1'}
user_map['8315'] = {'name': 'alice', 'IP': '192.168.1.20'}
user_map['8316'] = {'name': 'eve', 'IP': '192.168.1.21'}
user_map['0'] = {'name': 'root', 'IP': ''}

#db = GraphDatabase("/local/scratch/nik/opus_stuff/prov.neo4j")
db = GraphDatabase("/auto/homes/nb466/Downloads/prov.neo4j")

def get_date_time_str(sys_time):
    return datetime.datetime.fromtimestamp(sys_time).strftime(
        '%Y-%m-%d %H:%M:%S')

def get_user_rec(proc):
    if proc.OTHER_META.outgoing:
        for tmp_rel in proc.OTHER_META.outgoing:
            meta = tmp_rel.end
            if meta.has_key("name") and meta['name'] == 'uid':
                user = meta['value']
                return user_map[user]


def get_proc_data(pnode_id):
    rows = db.query("START p=node({id}) "
                    " MATCH (p)<-[:PROC_OBJ]-(l)<-[rel:LOC_OBJ]-(g) "
                    " WHERE rel.state in [{b}] "
                    " RETURN g, p",
                    id=pnode_id,
                    b=storage.LinkState.BIN)
    exe_name = ""
    sys_time = ""
    gnode_id = 0
    process_id = 0
    pstatus = ""
    user_name = ''
    user_ip = ''
    for row in rows:
        glob = row['g']
        proc = row['p']
        user_rec = get_user_rec(proc)
        if user_rec:
            user_name = user_rec['name']
            user_ip = user_rec['IP']

        exe_name = glob['name'][0]
        sys_time = get_date_time_str(proc['sys_time'])
        gnode_id = glob.id
        process_id = proc['pid']
        if proc['status'] == 1:
            pstatus = "DEAD"
        else:
            pstatus = "ALIVE"
    return exe_name, sys_time, gnode_id, process_id, user_name, user_ip


def get_all_procs():
    #print("Getting all processes in the graph")
    all_procs = []

    rows = db.query("START n=node(*) "
                    "where has(n.type) and n.type = 3 "
                    " return n order by id(n) desc ")
    for row in rows:
        p = row['n']
        all_procs.append(p.id)

    #print("Total number of processes: %d" % (len(all_procs)))
    return all_procs


def get_all_pairs(all_procs):
    #print("Getting all processes pairs in the graph")
    pair_list = []
    solo_procs = []

    for p in all_procs:
        pnode = db.node[p]
        if pnode.PROC_PARENT.outgoing:
            for tmp_rel in pnode.PROC_PARENT.outgoing:
                parent = tmp_rel.end
                pair_list.append([parent.id, pnode.id, "forked"])
        elif pnode.PROC_OBJ_PREV.outgoing:
            for tmp_rel in pnode.PROC_OBJ_PREV.outgoing:
                prevnode = tmp_rel.end
                pair_list.append([prevnode.id, pnode.id, "execed"])
        else:
            solo_procs.append(p)

    return pair_list, solo_procs


def get_proc_obj(p):
    proc_node = db.node[p]

    #print("Getting process data for PID: %d" % proc_node['pid'])
    exe, sys_time, gnode_id, pid, user_name, user_ip = get_proc_data(p)

    if p in proc_map:
        return proc_map[p]
    else:
        rec = {'id': p, 'gnode_id': gnode_id,
                'exe': exe, 'pid': pid,
                'time': '', 'children': []}
        if len(user_name) > 0:
            rec['user'] = user_name
        if len(user_ip) > 0:
            rec['ip'] = user_ip
        return rec
#    return pobj


def print_map(indent, pobj):
    #print("\t"*indent + " " + str(pobj['id']) + " " + pobj['exe'] + " - " + pobj['time'] + " Glob: " + str(pobj['gnode_id']))
    #print("\t"*indent + "%d %s %d - %d" % (pobj['id'], pobj['exe'], pobj['gnode_id'], pobj['pid']))

    for p in pobj['children']:
        print_map(indent + 1, p)


def treefy(pair_list, solo_procs):
    for p in solo_procs:
        pobj = get_proc_obj(p)
        proc_map[p] = pobj

    for rel in pair_list:
        p1 = rel[0]
        p2 = rel[1]
        how = rel[2]

        pobj1 = get_proc_obj(p1)
        pobj2 = get_proc_obj(p2)

        if how == "forked":
            for ch in pobj2['children']:
                pobj1['children'].insert(0, ch)
        elif how == "execed":
            pobj1['children'].insert(0, pobj2)

        if p2 in proc_map:
            del proc_map[p2]

        proc_map[p1] = pobj1

    for k, v in dict.items(proc_map):
        #print("------------")
        #print(str(v['id']) + " " + v['exe'] + " - " + v['time'] + " Glob: " + str(v['gnode_id']))
        #print("%d %s %d - %d" % (v['id'], v['exe'], v['gnode_id'], v['pid']))
        for p in v['children']:
            print_map(1, p)


all_procs = get_all_procs()
#print(all_procs)
#print("------------")

pair_list, solo_procs = get_all_pairs(all_procs)
#print(pair_list)

treefy(pair_list, solo_procs)

json_output = []
for k, v in dict.items(proc_map):
    json_output.append(v)

print(json.dumps(json_output, indent=4))
#with open('process_tree.json', 'w') as fp:
#    json.dump(json_output, fp)

db.shutdown()
