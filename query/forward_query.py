#! /usr/bin/env python2.7
# -*- coding: utf-8 -*-
'''
Retrieves workflow
'''

from __future__ import (absolute_import, division,
                        print_function, unicode_literals)

from neo4j import GraphDatabase, Evaluation, INCOMING

from opus import storage

import os
import sys
import json

node_map = {}
node_counter = 0
node_list = []
edge_list = []
edge_pairs = []

def add_node(ntype, name, nid=None):
    if name in node_map:
        return node_map[name]

    global node_counter
    node_counter = node_counter + 1
    if nid:
        node_list.append({'id': node_counter, 'type': ntype, 'name': name, 'gnode_id': nid})
    else:
        node_list.append({'id': node_counter, 'type': ntype, 'name': name})
    node_map[name] = node_counter
    return node_counter


def add_edge(src, dest, etype):
    if (src, dest) in edge_pairs:
        return
    edge_list.append({'src': src, 'dest': dest, 'type': etype})
    edge_pairs.append((src, dest))


def find_prev_write_version(db_iface, file_name, end_version):
    id_list = []
    ret_ver = 0

    rows = db_iface.query(
        "START file_glob_node=node:FILE_INDEX('name:\"" + file_name + "\"') "
        "MATCH file_glob_node-[rel1:LOC_OBJ]->file_loc_node,  "
        "file_loc_node-[:PROC_OBJ]->proc_node "
        "WHERE rel1.state in [{w},{rw}] "
        "and id(file_glob_node) <= " + end_version + " "
        "return file_glob_node, rel1 "
        "order by id(file_glob_node) desc",
        w=storage.LinkState.WRITE,
        rw=storage.LinkState.RaW)

    for row in rows:
        gnode = row['file_glob_node']
        rel = row['rel1']
        #print("%d: %s - %d" % (gnode.id, gnode['name'][0], rel['state']))
        id_list.append(gnode.id)

    if len(id_list) > 0:
        ret_ver = id_list.pop(0)

    return ret_ver

def find_next_write_version(db_iface, file_name, start_version):
    id_list = []
    ret_ver = None

    rows = db_iface.query(
        "START file_glob_node=node:FILE_INDEX('name:\"" + file_name + "\"') "
        "MATCH file_glob_node-[rel1:LOC_OBJ]->file_loc_node,  "
        "file_loc_node-[:PROC_OBJ]->proc_node "
        "WHERE rel1.state in [{w},{rw}] "
        "and id(file_glob_node) > " + start_version + " "
        "return file_glob_node, rel1 "
        "order by id(file_glob_node)",
        w=storage.LinkState.WRITE,
        rw=storage.LinkState.RaW)

    for row in rows:
        gnode = row['file_glob_node']
        rel = row['rel1']
        #print("%d: %s - %d" % (gnode.id, gnode['name'][0], rel['state']))
        id_list.append(gnode.id)

    if len(id_list) > 0:
        ret_ver = id_list.pop(0)

    return ret_ver


def find_progs_affected(db_iface, file_name, start_version, end_version):

    start_condition = ""
    if start_version is not None:
        start_condition = "AND id(proc_node) > " + str(start_version)

    end_condition = ""
    if end_version:
        end_condition = "AND id(proc_node) < " + str(end_version)

    rows = db_iface.query(
        "START glob_node=node:FILE_INDEX('name:\"" + file_name + "\"') "
        "MATCH glob_node-[rel1:LOC_OBJ]->loc_node-[:PROC_OBJ]->proc_node, "
        "proc_node<-[:PROC_OBJ]-loc_node1<-[rel2:LOC_OBJ]-file_node, "
        "proc_node<-[:PROC_OBJ]-loc_node2<-[rel3:LOC_OBJ]-bin_node "
        "WHERE rel1.state in [{r}] "
        "AND rel2.state in [{w}] "
        "AND rel3.state in [{b}] "
        #"AND id(glob_node) > " + start_version + " "
        #"AND id(proc_node) > " + start_version + end_condition + " "
        " " + start_condition + " " + end_condition + " "
        "return glob_node, proc_node, file_node, bin_node "
        "order by id(proc_node)",
        r=storage.LinkState.READ,
        w=storage.LinkState.WRITE,
        b=storage.LinkState.BIN)

    for row in rows:
        gnode = row['glob_node']
        pnode = row['proc_node']
        fnode = row['file_node']
        binary = row['bin_node']

        if fnode.has_key('name'):
            src_id = add_node('file', gnode['name'][0], gnode.id)
            bin_id = add_node('proc', binary['name'][0])
            dest_id = add_node('file', fnode['name'][0], fnode.id)
            add_edge(src_id, bin_id, 'r')
            add_edge(bin_id, dest_id, 'w')
            #print("FILE: %s, GLOB_ID: %d, Binary: %s, PID: %d, PROC_NODE_ID: %d, File: %s" % (
            #        gnode['name'][0], gnode.id, binary['name'][0],
            #        pnode['pid'], pnode.id, fnode['name'][0]))


def main():
    file_name = sys.argv[1] # File name
    start_version = sys.argv[2] # gnode_id passed from UI

    #db_iface = GraphDatabase("/local/scratch/nik/opus_stuff/prov.neo4j")
    db_iface = GraphDatabase("/auto/homes/nb466/Downloads/prov.neo4j")

    next_write_version = find_next_write_version(db_iface, file_name, start_version)
    if next_write_version:
        print("Next write version: %d" % (next_write_version))
    else:
        print("Next write version unbounded")

    prev_write_version = find_prev_write_version(db_iface, file_name, start_version)
    print("Prev write version: %d" % (prev_write_version))

    find_progs_affected(db_iface, file_name, prev_write_version, next_write_version)

    graph = {'nodes': node_list, 'edges': edge_list}
    print(json.dumps(graph, indent=4))


if __name__ == "__main__":
    main()
