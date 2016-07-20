
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

db = GraphDatabase("/local/scratch/nik/opus_stuff/prov.neo4j")

def get_date_time_str(sys_time):
    return datetime.datetime.fromtimestamp(sys_time).strftime(
        '%Y-%m-%d %H:%M:%S')

def get_proc_data(pid):
    rows = db.query("START p=node({id}) "
                    " MATCH (p)<-[:PROC_OBJ]-(l)<-[rel:LOC_OBJ]-(g) "
                    " WHERE rel.state in [{b}] "
                    " RETURN g, p",
                    id=pid,
                    b=storage.LinkState.BIN)
    exe_name = ""
    systime = ""
    for row in rows:
        glob = row['g']
        proc = row['p']
        exe_name = glob['name'][0]
        sys_time = get_date_time_str(proc['sys_time'])
    return exe_name, sys_time


def get_all_procs():
    all_procs = []

    rows = db.query("START n=node(*) "
                    "where has(n.type) and n.type = 3 "
                    " return n order by id(n) desc ")
    for row in rows:
        p = row['n']
        all_procs.append(p.id)
    return all_procs


def get_all_pairs(all_procs):
    pair_list = []

    for p in all_procs:
        pnode = db.node[p]
        if pnode.PROC_PARENT.outgoing:
            for tmp_rel in pnode.PROC_PARENT.outgoing:
                parent = tmp_rel.end
                pair_list.append([parent.id, pnode.id, "forked"])

        if pnode.PROC_OBJ_PREV.outgoing:
            for tmp_rel in pnode.PROC_OBJ_PREV.outgoing:
                prevnode = tmp_rel.end
                pair_list.append([prevnode.id, pnode.id, "execed"])

    return pair_list


def get_proc_obj(p):
    proc_node = db.node[p]
    exe, sys_time = get_proc_data(p)

    if p in proc_map:
        return proc_map[p]
    else:
        return {'id': p, 'exe': exe, 'time': sys_time, 'children': []}
    return pobj


def print_map(indent, pobj):
    print("\t"*indent + " " + str(pobj['id']) + " " + pobj['exe'] + " - " + pobj['time'])

    for p in pobj['children']:
        print_map(indent + 1, p)


def treefy(all_procs, pair_list):
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
        print("------------")
        print(str(v['id']) + " " + v['exe'] + " - " + v['time'])
        for p in v['children']:
            print_map(1, p)


all_procs = get_all_procs()
#print(all_procs)
print("------------")

pair_list = get_all_pairs(all_procs)
#print(pair_list)

treefy(all_procs, pair_list)

with open('process_tree.json', 'w') as fp:
    json.dump([proc_map], fp)

db.shutdown()
