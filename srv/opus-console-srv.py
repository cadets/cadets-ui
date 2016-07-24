#!/usr/bin/python

from cherrypy.process import plugins
import cherrypy
import threading
import re
import os
import json
import random as rdm
from subprocess import *
from numpy import *
import cgi


pinglat_rexp = re.compile("time=([ 0-9.]*)")
jdata = {}

class HelloWorld(object):
    @cherrypy.expose
    @cherrypy.tools.json_out()
    def proctree(self):
        with open('static/query-cache/proctree.json') as proctree_file:
            return proctree_file.read()

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def provgraph(self, gnode_id):
        print("PROVGRAPH!")
        with open('static/query-cache/'+cgi.escape(gnode_id)+'.json') as graph_file:
            return graph_file.read()

if __name__ == '__main__':
    cherrypy.config.update("srv.conf")
    rdm.seed()
    import os_dir
    cherrypy.quickstart(HelloWorld(), '', 'site.conf')
