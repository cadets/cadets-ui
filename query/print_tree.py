#! /usr/bin/env python2.7

from __future__ import (absolute_import, division,
                        print_function, unicode_literals)

import cPickle as pickle
import sys
import datetime

printed_list = []

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
            date_time_str = get_date_time_str(
                proc_tree_map[key]['sys_time'])

            cwd = proc_tree_map[key]['cwd']
            if current_dir != cwd:
                current_dir = cwd
                print("\t"*indent + "(Current directory: %s)" % (current_dir))

            print("\t"*indent + "[%s]: %s, (PID: %d), (node_id: %d)" %
                  (date_time_str,
                   proc_tree_map[key]['cmd_args'],
                   proc_tree_map[key]['pid'],
                   key))
            printed_list.append(key)
            for node_id in fl:
                print_recursive(indent + 1, node_id,
                                proc_tree_map, current_dir)

def print_recursive(indent, node_id, proc_tree_map, current_dir):
    if node_id in printed_list:
        return
    printed_list.append(node_id)

    if len(proc_tree_map[node_id]['cmd_args']) > 0:# or len(proc_tree_map[node_id]['cmd_args']) == 0:
        date_time_str = get_date_time_str(
            proc_tree_map[node_id]['sys_time'])
        cwd = proc_tree_map[node_id]['cwd']
        if current_dir != cwd:
            current_dir = cwd
            print("\t"*indent + "(Current directory: %s)" % (current_dir))

        print("\t"*indent + "[%s]: %s, (PID: %d), (node_id: %d)" %
              (date_time_str,
               proc_tree_map[node_id]['cmd_args'],
               proc_tree_map[node_id]['pid'],
               node_id))
        if len(proc_tree_map[node_id]['read_files']) > 0:
            #read_files = sorted(set(proc_tree_map[node_id]['read_files']))
            read_files = proc_tree_map[node_id]['read_files']
            print("\t"*(indent+3) + "READ: %s" % (str(read_files)))
            #print("\t"*(indent+3) + "READ: %s" % (','.join(read_files)))
        if len(proc_tree_map[node_id]['write_files']) > 0:
            #write_files = sorted(set(proc_tree_map[node_id]['write_files']))
            write_files = proc_tree_map[node_id]['write_files']
            #print("\t"*(indent+3) + "WROTE: %s" % (','.join(write_files)))
            print("\t"*(indent+3) + "WROTE: %s" % (str(write_files)))
        if len(proc_tree_map[node_id]['read_write_files']) > 0:
            #read_write_files = sorted(set(proc_tree_map[node_id]['read_write_files']))
            read_write_files = proc_tree_map[node_id]['read_write_files']
            #print("\t"*(indent+3) + "READ/WROTE: %s" % (','.join(read_write_files)))
            print("\t"*(indent+3) + "READ/WROTE: %s" % (str(read_write_files)))
        if len(proc_tree_map[node_id]['executed_files']) > 0:
            executed_files = proc_tree_map[node_id]['executed_files']
            print("\t"*(indent+3) + "EXECUTED: %s" % (str(executed_files)))

    if ('execed' in proc_tree_map[node_id] and
        len(proc_tree_map[node_id]['execed']) > 0):
        el = proc_tree_map[node_id]['execed']
        el.sort()
        for ni in el:
            print_recursive(indent, ni, proc_tree_map, current_dir)
    if ('forked' in proc_tree_map[node_id]
        and len(proc_tree_map[node_id]['forked'])):
        fl = proc_tree_map[node_id]['forked']
        fl.sort()
        for ni in fl:
            print_recursive(indent + 1, ni, proc_tree_map, current_dir)


def print_map(proc_tree_map):
    for key in sorted(proc_tree_map):
        rec = proc_tree_map[key]
        print("%d -> PID: %d, cmd_args: %s, execed: %s, forked: %s" %
                (key, rec['pid'], rec['cmd_args'], rec['execed'], rec['forked']))
        print("")


def main():
    proc_tree_map = load_proc_tree_map(sys.argv[1])
    #print_map(proc_tree_map)
    #print("*" * 100)
    print_tree(proc_tree_map)

if __name__ == "__main__":
    main()
