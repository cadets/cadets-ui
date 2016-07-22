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
import datetime
import cPickle as pickle
import hashlib
import logging
import re
import sys


action_dict = {0: 'None', 1: 'Copy On Touch', 2: 'Read', 3: 'Write',
               4: 'ReadWrite', 5: 'Close', 6: 'Delete', 7: 'Exec',
               8: 'CoE', 9: 'Close on Exec', 10: 'Inactive'}

start_filters = ['/etc/', '/lib/', '/var/', '/dev/', '.sh_history',
                 '.bashrc', '/run', '/bin', '/sbin', '/proc', '/opt', '/usr/include']

end_filters = ['.sh_history', '.bashrc', 'logilab_common-0.61.0-nspkg.pth',
               '.cache', '.config', '.bash_history', '.profile', 'pam_unix.so.6',
               'libintl.so.8', 'termcap.db']

# Filters to remove the sshd and sudo noise
file_filters = ['/home/bob/.login_conf', '/usr/lib/libasn1.so.11', '/usr/lib/libbsm.so.3',
                '/usr/lib/libcom_err.so.5', '/usr/lib/libgssapi.so.10', '/usr/lib/libgssapi_krb5.so.10',
                '/usr/lib/libgssapi_spnego.so.10', '/usr/lib/libheimbase.so.11', '/usr/lib/libhx509.so.11',
                '/usr/lib/libkrb5.so.11', '/usr/lib/libopie.so.8', '/usr/lib/libpam.so.5',
                '/usr/lib/libpam.so.6', '/usr/lib/libprivateheimipcc.so.11', '/usr/lib/libprivateldns.so.5',
                '/usr/lib/libprivatessh.so.5', '/usr/lib/libroken.so.11', '/usr/lib/libwind.so.11',
                '/usr/lib/libwrap.so.6', '/usr/lib/libypclnt.so.4', '/usr/lib/pam_login_access.so.5',
                '/usr/lib/pam_login_access.so.6', '/usr/lib/pam_nologin.so.6', '/usr/lib/pam_opie.so.5',
                '/usr/lib/pam_opie.so.6', '/usr/lib/pam_opieaccess.so.5', '/usr/lib/pam_opieaccess.so.6',
                '/usr/lib/pam_permit.so.5', '/usr/lib/pam_permit.so.6', '/usr/lib/pam_unix.so.5',
                '/usr/local/etc/pam.d/sudo', '/usr/local/etc/sudoers', '/usr/local/etc/sudoers.d',
                '/usr/local/libexec/sudo/libsudo_util.so.0', '/usr/local/libexec/sudo/sudoers.so',
                '/usr/share/zoneinfo/UTC', '/usr/share/zoneinfo/posixrules']


class GlobData(object):
    proc_list = []
    file_hist_list = []
    visited_list = []
    queried_file = ""
    queried_file_last_modified_time = 0

    @staticmethod
    def clear_data():
        del GlobData.proc_list[:]
        del GlobData.file_hist_list[:]
        del GlobData.visited_list[:]
        GlobData.queried_file = ""
        GlobData.queried_file_last_modified_time = 0

# Algorithm:
# 1. Get the process that wrote to the file.
# 2. Get files read, written or executed by that process
# 3. Get parent/prev process. Do step 2 for that process.
#    If no more parents/prevs go to step 4.
# 4. For each file (rwx) repeat from step 1.


def get_date_time_str(sys_time):
    return datetime.datetime.fromtimestamp(sys_time).strftime(
        '%Y-%m-%d %H:%M:%S')


def update_last_modified_time(sys_time):
    if sys_time > GlobData.queried_file_last_modified_time:
        GlobData.queried_file_last_modified_time = sys_time


def check_filter(glob_node):
    if not glob_node.has_key('name'):
        return False
    name = glob_node['name'][0]
    for f in start_filters:
        if name.startswith(f):
            return False
    for f in end_filters:
        if name.endswith(f):
            return False
    for f in file_filters:
        if name == f:
            return False

    # Check for hidden dirs in path
    search_obj = re.search(r'\/\..*\/', name, re.M | re.I)
    if search_obj:
        return False

    return True


def get_command_args(proc_node):
    for tmp_rel in proc_node.OTHER_META.outgoing:
        if tmp_rel.end['name'] != "cmd_args":
            continue
        cmd_args_node = tmp_rel.end
        return cmd_args_node['value']
    return ""


def get_cwd(proc_node):
    for tmp_rel in proc_node.OTHER_META.outgoing:
        if tmp_rel.end['name'] != "cwd":
            continue
        cwd = tmp_rel.end
        return cwd['value']


def get_meta(link_type):
    name_value_map = {}
    for tmp_rel in link_type.outgoing:
        if not tmp_rel.end.has_key('name') or not tmp_rel.end.has_key('value'):
            continue
        name_value_map[tmp_rel.end['name']] = tmp_rel.end['value']
    return name_value_map


def descend_down_proc_tree(db_iface, proc_node, proc_tree_map, end_nid):
    '''Recursively descends down the process hierarchy and finds
    files written, read or executed'''
    if proc_node.id > end_nid:
        return

    if proc_node.PROC_PARENT.incoming:
        for tmp_rel in proc_node.PROC_PARENT.incoming:
            child_proc_node = tmp_rel.start
            descend_down_proc_tree(db_iface, child_proc_node, proc_tree_map, end_nid)
    if proc_node.PROC_OBJ_PREV.incoming:
        for tmp_rel in proc_node.PROC_OBJ_PREV.incoming:
            child_proc_node = tmp_rel.start
            descend_down_proc_tree(db_iface, child_proc_node, proc_tree_map, end_nid)

    find_files_read_and_written_by_process(db_iface, proc_node, proc_tree_map, end_nid)


def add_file(glob_node, lineage_list, file_list):
    lineage_list.append(glob_node)
    if glob_node.has_key('name') and glob_node['name'][0] not in file_list:
        file_list.append(glob_node['name'][0])


def find_files_read_and_written_by_process(db_iface, proc_node, proc_tree_map, end_nid):
    if proc_node.id > end_nid:
        return

    if proc_node.id in GlobData.proc_list:
        return

    GlobData.proc_list.append(proc_node.id)

    lineage_list = []
    read_files = []
    write_files = []
    executed_files = []
    read_write_files = []
    cmd_args = get_command_args(proc_node)
    cwd = get_cwd(proc_node)
    sys_meta = get_meta(proc_node.OTHER_META)
    env_meta = get_meta(proc_node.ENV_META)
    lib_meta = get_meta(proc_node.LIB_META)

    rows = db_iface.query(
        "START proc_node=node(" + str(proc_node.id) + ") "
        "MATCH proc_node<-[:PROC_OBJ]-loc_node, "
        "loc_node<-[rel:LOC_OBJ]-glob_node "
        "WHERE rel.state in [{r},{w},{rw},{b}] "
        "AND id(glob_node) <= " + end_nid + " "
        "RETURN glob_node, rel "
        "ORDER BY glob_node.node_id desc",
        r=storage.LinkState.READ,
        w=storage.LinkState.WRITE,
        rw=storage.LinkState.RaW,
        b=storage.LinkState.BIN)

    for row in rows:
        glob_node = row['glob_node']
        rel = row['rel']

        if check_filter(glob_node) is False:
            continue

        if rel['state'] == storage.LinkState.READ:
            add_file(glob_node, lineage_list, read_files)
        elif rel['state'] == storage.LinkState.WRITE:
            add_file(glob_node, lineage_list, write_files)
        elif rel['state'] == storage.LinkState.RaW:
            add_file(glob_node, lineage_list, read_write_files)
        elif rel['state'] == storage.LinkState.BIN:
            add_file(glob_node, lineage_list, executed_files)

    if proc_node.id not in proc_tree_map:
        proc_tree_map[proc_node.id] = {'forked': [], 'execed': []}
    proc_tree_map[proc_node.id].update({'pid': proc_node['pid'],
                                        'sys_time': proc_node['sys_time'],
                                        'cwd': cwd,
                                        'cmd_args': cmd_args,
                                        'sys_meta': sys_meta,
                                        'env_meta': env_meta,
                                        'lib_meta': lib_meta,
                                        'write_files': write_files,
                                        'read_files': read_files,
                                        'read_write_files': read_write_files,
                                        'executed_files': executed_files})

    if proc_node.PROC_PARENT.outgoing:
        for r1 in proc_node.PROC_PARENT.outgoing:
            if r1.end.id not in proc_tree_map:
                proc_tree_map[r1.end.id] = {'pid': proc_node['pid'],
                                            'forked': [proc_node.id],
                                            'execed': []}
            else:
                proc_tree_map[r1.end.id]['forked'].append(proc_node.id)

            find_files_read_and_written_by_process(db_iface, r1.end,
                                                   proc_tree_map, end_nid)
    if proc_node.PROC_OBJ_PREV.outgoing:
        for r1 in proc_node.PROC_OBJ_PREV.outgoing:
            if r1.end.id not in proc_tree_map:
                proc_tree_map[r1.end.id] = {'pid': proc_node['pid'],
                                            'execed': [proc_node.id],
                                            'forked': []}
            else:
                proc_tree_map[r1.end.id]['execed'].append(proc_node.id)

            find_files_read_and_written_by_process(db_iface, r1.end,
                                                   proc_tree_map, end_nid)

    if len(lineage_list) == 0:
        return

    # Get write history for the files we are interested in
    for gnode in lineage_list:
        file_name = gnode['name'][0]
        if file_name not in GlobData.file_hist_list:
            get_write_history(db_iface, gnode['name'][0], proc_tree_map, str(gnode.id))


def get_write_history(db_iface, file_name, proc_tree_map, end_nid):

    if file_name in GlobData.file_hist_list:
        return

    GlobData.file_hist_list.append(file_name)
    logging.debug("Getting write histories for: %s", file_name)

    rows = db_iface.query(
        "START file_glob_node=node:FILE_INDEX('name:\"" + file_name + "\"') "
        "MATCH file_glob_node-[rel1:LOC_OBJ]->file_loc_node,  "
        "file_loc_node-[:PROC_OBJ]->proc_node "
        "WHERE rel1.state in [{w}] "
        "AND id(file_glob_node) <= " + end_nid + " "
        "RETURN distinct proc_node "
        "ORDER by proc_node.node_id DESC",
        w=storage.LinkState.WRITE)

    for row in rows:
        proc_node = row['proc_node']

        find_files_read_and_written_by_process(db_iface, proc_node,
                                               proc_tree_map, end_nid)

def get_write_history_specific_version(db_iface, file_name, proc_tree_map, end_nid):

    if file_name in GlobData.file_hist_list:
        return

    GlobData.file_hist_list.append(file_name)
    logging.debug("Getting write histories for: %s", file_name)

    rows = db_iface.query(
        "START file_glob_node=node(" + end_nid + ") "
        "MATCH file_glob_node-[rel1:LOC_OBJ]->file_loc_node,  "
        "file_loc_node-[:PROC_OBJ]->proc_node "
        "WHERE rel1.state in [{w},{rw}] "
        "RETURN distinct proc_node "
        "ORDER by proc_node.node_id DESC",
        w=storage.LinkState.WRITE,
        rw=storage.LinkState.RaW)

    for row in rows:
        proc_node = row['proc_node']

        if file_name == GlobData.queried_file:
            update_last_modified_time(proc_node['sys_time'])

        print("Finding files read and written by process PID: %d, ID: %d" % (proc_node['pid'], proc_node.id))
        find_files_read_and_written_by_process(db_iface, proc_node, proc_tree_map, end_nid)

def get_fork_exec(node_id, proc_tree_map, proc_nodes):
    if node_id in GlobData.visited_list:
        return

    GlobData.visited_list.append(node_id)
    proc_nodes.append(node_id)
    if "forked" in proc_tree_map[node_id]:
        fl = proc_tree_map[node_id]['forked']
        for n_id in fl:
            get_fork_exec(n_id, proc_tree_map, proc_nodes)
    if "execed" in proc_tree_map[node_id]:
        el = proc_tree_map[node_id]['execed']
        for n_id in el:
            get_fork_exec(n_id, proc_tree_map, proc_nodes)


def get_all_processes(db_iface, proc_tree_map, end_nid):
    if len(GlobData.proc_list) == 0:
        logging.debug("No write history available")
        return

    proc_nodes = []
    for key in sorted(proc_tree_map):
        if key in GlobData.visited_list:
            continue
        GlobData.visited_list.append(key)
        if 'forked' in proc_tree_map[key]:
            fl = proc_tree_map[key]['forked']
            fl.sort()
            for node_id in fl:
                get_fork_exec(node_id, proc_tree_map, proc_nodes)

    proc_nodes = sorted(set(proc_nodes))
    for node_id in proc_nodes:
        proc_node = db_iface.node[node_id]
        descend_down_proc_tree(db_iface, proc_node, proc_tree_map, end_nid)


def save_proc_tree_map(proc_tree_map, file_name):
    pickle.dump(proc_tree_map, open(file_name, "wb"))


def load_proc_tree_map(file_name):
    return pickle.load(open(file_name, "rb"))


def get_hash(name):
    hasher = hashlib.sha1()
    hasher.update(name)
    return hasher.hexdigest()


def get_global_versions(db_iface, file_name, end_nid):
    id_list = []
    rows = db_iface.query(
        "START file_glob_node=node:FILE_INDEX('name:\"" + file_name + "\"') "
        "MATCH file_glob_node-[rel1:LOC_OBJ]->file_loc_node,  "
        "file_loc_node-[:PROC_OBJ]->proc_node "
        "WHERE id(file_glob_node) < " + end_nid + " "
        "return file_glob_node "
        "order by id(file_glob_node) ")

    for row in rows:
        glob_node = row['file_glob_node']
        print(glob_node.id)
        id_list.append(glob_node.id)

    return id_list[-2]

def main():
    file_name = sys.argv[1]
    end_nid = sys.argv[2] # End node_id. Global object version node ID

    db_iface = GraphDatabase("/auto/homes/nb466/Downloads/prov.neo4j")

    GlobData.clear_data()
    proc_tree_map = {}

    version_id = get_global_versions(db_iface, file_name, end_nid)
    print("Version ID: %d" % (version_id))

    get_write_history_specific_version(db_iface, file_name, proc_tree_map, str(version_id))
    #get_all_processes(db_iface, proc_tree_map, end_nid)

    save_proc_tree_map(proc_tree_map, "proc_tree_map.dat")
    logging.debug("Successfully generated history...saved data on disk\n")


if __name__ == "__main__":
    main()
