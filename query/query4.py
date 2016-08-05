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


def find_files_written(db_iface, proc_node, start_version):
    write_list = []

    rows = db_iface.query(
        "START proc_node=node({pid}) "
        "MATCH proc_node<-[:PROC_OBJ]-loc_node1<-[rel1:LOC_OBJ]-write_node "
        "WHERE rel1.state in [{w}] "
        "AND id(write_node) >= " + start_version + " "
        "return write_node "
        "order by id(write_node)",
        pid=proc_node.id,
        w=storage.LinkState.WRITE)

    for row in rows:
        write_node = row['write_node']
        if write_node.has_key('name'):
            write_list.append(write_node['name'][0])
    return sorted(set(write_list))


def find_files_read(db_iface, proc_node, start_version):
    read_list = []

    rows = db_iface.query(
        "START proc_node=node({pid}) "
        "MATCH proc_node<-[:PROC_OBJ]-loc_node1<-[rel1:LOC_OBJ]-read_node "
        "WHERE rel1.state in [{r}] "
        "AND id(read_node) >= " + start_version + " "
        "return proc_node, read_node "
        "order by id(read_node)",
        pid=proc_node.id,
        r=storage.LinkState.READ)

    for row in rows:
        read_node = row['read_node']
        if read_node.has_key('name'):
            read_list.append(read_node['name'][0])
    return sorted(set(read_list))


def find_progs_affected(db_iface, file_name, start_version):

    bin_node = None
    proc_node = None
    rows = db_iface.query(
        "START bin_node=node:FILE_INDEX('name:\"" + file_name + "\"') "
        "MATCH bin_node-[rel1:LOC_OBJ]->loc_node-[:PROC_OBJ]->proc_node "
        "WHERE rel1.state in [{b}] "
        "AND id(bin_node) >= " + start_version + " "
        "return bin_node, proc_node "
        "order by id(proc_node)",
        b=storage.LinkState.BIN)

    for row in rows:
        bin_node = row['bin_node']
        proc_node = row['proc_node']
        break

    bin_id = add_node('proc', bin_node['name'][0])
    if proc_node:
        rlist = find_files_read(db_iface, proc_node, start_version)
        for f in rlist:
            file_id = add_node('file', f)
            add_edge(file_id, bin_id, 'r')

        wlist = find_files_written(db_iface, proc_node, start_version)
        for f in wlist:
            file_id = add_node('file', f)
            add_edge(bin_id, file_id, 'w')



def main():
    file_name = sys.argv[1] # File name
    start_version = sys.argv[2] # gnode_id passed from UI

    db_iface = GraphDatabase("/auto/homes/nb466/Downloads/prov.neo4j")

    find_progs_affected(db_iface, file_name, start_version)

    graph = {'nodes': node_list, 'edges': edge_list}
    print(json.dumps(graph, indent=4))


if __name__ == "__main__":
    main()
