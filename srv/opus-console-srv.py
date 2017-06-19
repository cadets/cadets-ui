#!/usr/bin/python

import cherrypy
import re
import random as rdm
import cgi


pinglat_rexp = re.compile("time=([ 0-9.]*)")
jdata = {}

class OpusDemoSrv(object):
    @cherrypy.expose
    def default(self, *args, **kwargs):
        raise cherrypy.HTTPRedirect("/static/index.html")

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def proctree(self):
        with open('static/query-cache/proc_tree.json') as proctree_file:
            return proctree_file.read()

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def provgraph(self, gnode_id):
        with open('static/query-cache/'+cgi.escape(gnode_id)+'.json') as graph_file:
            return graph_file.read()

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def provdetail(self, gnode_id):
        with open('static/query-cache/'+cgi.escape(gnode_id)+'_files.json') as graph_file:
            return graph_file.read()

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def filegraph(self, gnode_id):
        try:
            with open('static/query-cache/'+cgi.escape(gnode_id)+'.json') as graph_file:
                return graph_file.read()
        except:
            return "{}"

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def fwdgraph(self, gnode_id):
        with open('static/query-cache/fwd-'+cgi.escape(gnode_id)+'.json') as graph_file:
            return graph_file.read()

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def diffgraph(self, gnode_id1, gnode_id2):
        r1 = int(cgi.escape(gnode_id1));
        r2 = int(cgi.escape(gnode_id2));
        if r2 < r1:
            r1, r2 = r2, r1
        with open('static/query-cache/diff-'+str(r1)+'-'+str(r2)+'.json') as graph_file:
            return graph_file.read()

if __name__ == '__main__':
    cherrypy.config.update("srv.conf")
    rdm.seed()
    import os_dir
    cherrypy.quickstart(OpusDemoSrv(), '/', 'site.conf')
