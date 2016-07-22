#! /usr/bin/env python2.7

from __future__ import (absolute_import, division,
                        print_function, unicode_literals)

import cPickle as pickle
import sys
import datetime
import json

printed_list = []
node_list = []
edge_list = []

node_map = {} # name -> id

node_counter = 0

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
    edge_list.append({'src': src, 'dest': dest, 'type': etype})

def get_date_time_str(sys_time):
    return datetime.datetime.fromtimestamp(sys_time).strftime(
        '%Y-%m-%d %H:%M:%S')

def load_proc_tree_map(file_name):
    return pickle.load(open(file_name, "rb"))

def print_tree(proc_tree_map):
    indent = 0
    current_dir = None
    for key in sorted(proc_tree_map):
        if key in printed_list:
            continue

        if 'forked' in proc_tree_map[key]:
            fl = proc_tree_map[key]['forked']
            fl.sort()

            src_id = add_node('proc', proc_tree_map[key]['cmd_args'])

            printed_list.append(key)
            for node_id in fl:
                print_recursive(indent + 1, node_id, proc_tree_map, src_id)


def sort_unique(file_list):
    fmap = {} # File name to lowest ID

    for fn in file_list:
        fname, fid = fn
        if fname not in fmap:
            fmap[fname] = fid
        else:
            if fid < fmap[fname]:
                fmap[fname] = fid
    return fmap


def print_recursive(indent, node_id, proc_tree_map, psrc_id):
    if node_id in printed_list:
        return
    printed_list.append(node_id)

    src_id = psrc_id
    if len(proc_tree_map[node_id]['cmd_args']) > 0:
        src_id = add_node('proc', proc_tree_map[node_id]['cmd_args'])
        add_edge(psrc_id, src_id, 'parent')

        if len(proc_tree_map[node_id]['read_files']) > 0:
            read_files = sort_unique(proc_tree_map[node_id]['read_files'])
            for rf, rfid in dict.items(read_files):
                dest_id = add_node('file', rf, rfid)
                add_edge(dest_id, src_id, 'r')

        if len(proc_tree_map[node_id]['write_files']) > 0:
            write_files = sort_unique(proc_tree_map[node_id]['write_files'])
            for wf, wfid in dict.items(write_files):
                dest_id = add_node('file', wf, wfid)
                add_edge(src_id, dest_id, 'w')

        if len(proc_tree_map[node_id]['read_write_files']) > 0:
            read_write_files = sort_unique(proc_tree_map[node_id]['read_write_files'])
            for rwf, rwfid in dict.items(read_write_files):
                dest_id = add_node('file', rwf, rwfid)
                add_edge(src_id, dest_id, 'rw')

    if ('execed' in proc_tree_map[node_id] and
        len(proc_tree_map[node_id]['execed']) > 0):
        el = proc_tree_map[node_id]['execed']
        el.sort()
        for ni in el:
            print_recursive(indent, ni, proc_tree_map, psrc_id)
    if ('forked' in proc_tree_map[node_id]
        and len(proc_tree_map[node_id]['forked'])):
        fl = proc_tree_map[node_id]['forked']
        fl.sort()
        for ni in fl:
            print_recursive(indent + 1, ni, proc_tree_map, src_id)


def main():
    proc_tree_map = load_proc_tree_map(sys.argv[1])
    print_tree(proc_tree_map)
    graph = {'nodes': node_list, 'edges': edge_list}

    print(json.dumps(graph, indent=4))

if __name__ == "__main__":
    main()
