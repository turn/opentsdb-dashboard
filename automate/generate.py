#!/usr/bin/python

# This file is part of OpenTSDB Dashboards.
# Copyright (C) 2013  Turn Inc.
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published by
# the Free Software Foundation, either version 2.1 of the License, or (at your
# option) any later version.  This program is distributed in the hope that it
# will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
# of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
# General Public License for more details.  You should have received a copy
# of the GNU Lesser General Public License along with this program.  If not,
# see <http://www.gnu.org/licenses/>.

import sys
import json
import time

op_filename = ""

if len(sys.argv) < 2:
  print "Execute script as python generate.py <template_file> <output_file> \n <output_file is optional"
  sys.exit()

input_file_name = sys.argv[1]  # sample template file
json_data = open(input_file_name) ## Loading the template JSON to build dashboard
data = json.load(json_data)

if len(sys.argv) == 3:   # Output file name. Optional Argument
  op_filename = str(sys.argv[2])
else:
  if data['filename']!="":
    op_filename = str(data['filename'])
    if ".json" not in op_filename:
      op_filename = op_filename + ".json"
  else:
    op_filename = str(int(time.time()))+".json"


def build_dashboard_properties(data,decoder):
  global op_filename
  columns = 2
  info = ""
  dashboard_title = "Dummy"
  refresh_interval = 300
  dc = "*"
  sclass = "*"
  start_time = "12h-ago"
  end_time = ""
  if data['columns']:
    columns = data['columns']
  if data['dashboard_title']:
    dashboard_title = data['dashboard_title']
  if data['refresh']:
    refresh_interval = data['refresh']
  if data['default_dc']:
    dc = data['default_dc']
  if data['default_sclass']:
    sclass = data['default_sclass']
  if data['start_time']:
    start_time = data['start_time']
  if data['end_time']:
    end_time = data['end_time']
  if data['info']:
    content = open(data['info'],"r").read()
    info = json.loads(json.dumps(content))
  return "\"dashboard_properties\":\n"+\
             "{\n"+"   \"title\":\"" + dashboard_title + "\",\n" +\
             "   \"column\":" + str(columns) + ",\n" +\
             "   \"info\":\n" + str(info) + ",\n" +\
             "   \"refesh\":" + str(refresh_interval) + ",\n" +\
             "   \"dc\":\"" + dc + "\",\n" +\
             "   \"sclass\":\"" + sclass + "\",\n" +\
             "   \"start_time\":\"" + str(start_time) + "\",\n" +\
             "   \"end_time\":\"" + str(end_time) + "\"\n" +\
             "}," 
  
def build_panel_objects(panel_objects,decoder):
  panel_object_strg = ""
  graph_object_strg = ""
  count = 0
  for itr in panel_objects:
    if count > 0:
      panel_object_strg =  panel_object_strg + ",\n"

    panel_object_strg += "{\n  \"title\":\""+itr['title']+"\"," +\
                               "\"height\":\""+str(itr['height'])+"\"," +\
                               "\"width\":\""+str(itr['width'])+"\",\n" +\
                               "  \"graph_objects\":\n     [\n"
    if len(itr['graph_objects']) > 0 :
      count = count + 1
      graph_object = itr['graph_objects']
      for graph_object_itr in graph_object:
        try:
          with open(str(graph_object_itr['path'])): 
            if len(graph_object_strg)==0:
              content = open(graph_object_itr['path']).read()
              graph_object_strg = "      "+ json.loads(json.dumps(content))
            else:
              content = open(graph_object_itr['path']).read()
              graph_object_strg = graph_object_strg + ",\n     " + json.loads(json.dumps(content))
        except IOError:
          print "File Not Found!!"+str(graph_object_itr['path'])
      panel_object_strg +=  graph_object_strg
    panel_object_strg = panel_object_strg + "\n     ]}"
    graph_object_strg =""
  return "\n\"panel_objects\":\n[\n"+panel_object_strg+"\n]"

if data['panel_objects']:
  decoder = json.JSONDecoder()
  output = "{\n" + build_dashboard_properties(data,decoder) + build_panel_objects(data['panel_objects'],decoder) +"\n}"
  fp = open(op_filename,'w')
  fp.write(output)
  fp.close()
