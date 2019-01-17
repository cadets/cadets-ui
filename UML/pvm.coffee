@startuml
GraphEntity <|-- PVmEdge
GraphEntity <|-- PVmNode
PVmNode <|-- EditSession
GraphEntity <|-- Path
PVmNode <|-- Socket
PVmNode <|-- Process
PVmNode <|-- FileVersion
GraphEntity -- PVMv2Parser 
PVmEdge -- Path





class GraphEntity
{
	{field} +id 
	+properties
}
note left: A Neo4j node or edge

class PVmEdge 
{
	{field} +source
	+dest
	+style_name
}
note left: Every PVM graph edge has the following fields:\nid: Neo4j database ID\nsource: Database ID of the originating node\ndest: Database ID of the terminating node\nstyle_name: A CSS-friendly name for the edge type


class PVmNode
{
	{field} +label
	+short_name
	+style_name
	+properties
}
note right: Every PVM graph node has the following fields:\n\nid: a unique ID that will be the primary ID for the graph node\nlabel: a longer human-readable string for display in lists and graph\n(e.g., a file path or a process' command line)\nshort_name: a name that is short and ideally human-meaningful, but which is not necessarily unique\nstyle_name: used by graphing code to look up, e.g., icons\nproperties: a set of raw named properties from the database\n — these can be presented to the user for interpretation but are not necessarily interpreted by the UI itself\nIn addition to these, subclasses of PvmNode add fields that are relevant to the type.\nFor example, Process objects have a @pid (process ID) field.


class EditSession
{
	{field} +uuid
	{method} +Redefines @label = properties.name or @label =@uuid 
}

class FileVersion
{
	
}

class Process
{
	{field} +pid
	
	
	
}

class Socket
{
	{field} +uuid
}

class Path
{
	{field} +path
	{method} +A Path node can be referenced by `NAMED` edges.
}

class PVMv2Parser
{
	{method} +parseNodeOrEdge
	{method} +parseEdge
	{method} +parseNode
	{method} +fileVersion
	{method} +process
	{method} +ParseEdge 
	{method} +ParseNode
	
}
note bottom: A parser for PVMv2 nodes and edges\nParse a record that may be a node or an edge\nParse a PVM edge\nParse a Node of unknown type\nParse a (known) FileVersion\nParse a (known) Process



@enduml
