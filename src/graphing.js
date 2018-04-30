// require('cytoscape-autopan-on-drag')(cytoscape);

import $ from './../node_modules/jquery/dist/jquery.js';
import cytoscape from './../node_modules/cytoscape/dist/cytoscape.min.js';
import moment from './../node_modules/moment/moment.js';

import connectionOrig from './img/connection.png';
import procOrig from './img/proc.png';
import file_versionOrig from './img/file-version.png';
import edit_sessionOrig from './img/edit-session.png';
import cadets_machineOrig from './img/cadets-machine.svg';
import machine_externalOrig from './img/machine-external.svg';
import pipeOrig from './img/pipe.png';
import socketOrig from './img/socket.png';
import FileNeon from './img/FileNeonNBG.png';
import editNeon from './img/editNeonNBG.png';
import procNeon from './img/procNeonNBG.png';
import pipeNeon from './img/pipeNeonNBG.png';
import SocketNeon from './img/SocketNeonNBG.png';
import connNeon from './img/connNeonNBG.png';
import machineNeon from './img/machineNeonNBG.png';
import cMachineNeon from './img/cMachineNeonNBG.png';

var connection;
var proc;
var file_version;
var edit_session;
var cadets_machine;
var machine_external;
var pipe;
var socket;
var fileCompoundColor;
var pipeCompoundColor;
var socketCompoundColor;
var importantColor;
var textColor;

var pvm_version = null;
var PVMvLexicon = null;

//
// Create a new graph.
//
export function create(container=null) {
	let graph;
	if(container == null){
		graph = cytoscape();
	}
	else{
		graph = cytoscape({
			container: document.getElementById(container),
			boxSelectionEnabled: true,
		});
		load_graph_style([ graph ]);
	}
	return graph;
}

//
// Add a node to a graph.
//
export function add_node(data, graphs, renderedPosition = null, highLightedIDs = []) {
	add_node_batch([data], graphs, renderedPosition = null, highLightedIDs = []);
}


export function add_node_batch(nodes, graphs, renderedPosition = null, highLightedIDs = [], fn=null ) {
	let parsedNodes = [];
	let nodesToHighLight = [];
	
	if(!Array.isArray(graphs)){graphs = [graphs];}
	let graphAmount = graphs.length;
	if(graphAmount == 1){
		graphs = graphs.concat(graphs[0]);
	}
	nodes.forEach(function(data){

		if(fn != null){
			fn(data);
		}
		if(renderedPosition == null){
			renderedPosition = {
				x: graphs[0].width() / 2,
				y: graphs[0].height() / 2,
			};
		}
		// Have we already imported this node?
		if (!graphs[1].$id(data.id).empty()) {
			return;
		}

		// When importing things with abstract containers (e.g., file versions),
		// draw a compound node to show the abstraction and simplify the versions.
		if (data.uuid && (['file-version', 'pipe-endpoint', 'socket-version', 'edit-session'].indexOf(data.type) != -1)) {
			let compound = graphs[1].$id(data.uuid);
			let type = data.type.substr(0, 4);

			let name = [];
			if(data.name){
				name = name.concat(data.name);
			}
			if (name == null) {
				name = new Set().add(data.hash);
			}
			// Add file descriptors if we have them.
			switch(pvm_version.low){
				case(1):
					if (data.fds) {
						for(let fd of data.fds){
							name = name.concat('FD ' + fd);
						}
					}
					break;
				case(2):
					if(data.fd){
						name = name.concat('FD ' + data.fd);
					}
					break;
				default:
					console.log(`graphing.js - add_node_batch pvm_version:${pvm_version} not implemented for file descriptors`);
			}

			if (compound.empty()) {
				if(name == ''){
					name = ['node'];
				}
				add_node({
					id: data.uuid,
					type: type,
					label: parseNodeName(name, '\n'),
					names: name,
					'parent': data['parent'],
				}, graphs, renderedPosition);
			} else {
				let existing = compound.data();
				switch(pvm_version.low){
					case(1):
						existing.names = new Set([...existing.names, ...name]);
						existing.label = Array.from(existing.names).join(' ');
						break;
					case(2):
						if(!existing.names.indexOf(name)){
							existing.names = existing.names.concat(name);
						}
						existing.label = existing.names;
						break;
					default:
						console.log(`graphing.js - add_node_batch pvm_version:${pvm_version} not implemented`);
				}
			}
			data['parent'] = data.uuid;
		}

		let node = {
			data: data,
			renderedPosition: renderedPosition,
		};

		node.classes = data.type;
		if (data.external) {
			node.classes += ' external';
		}

		node.data.label = node_metadata(data).label;
		
		if(highLightedIDs.indexOf(`${data.id}`) >= 0){
			nodesToHighLight = nodesToHighLight.concat(data.id);
		}

		parsedNodes = parsedNodes.concat(node);
	});
	if(graphAmount == 1){graphs.pop();}
	for(let graph of graphs){
		graph.add(parsedNodes);
		nodesToHighLight.forEach(function(id){
			graph.$id( id ).addClass('important');
		})
	}
}

export function add_edge(data, graphs) {
	add_edge_batch([data], graphs);
}

export function add_edge_batch(edges, graphs){
	let graphAmount = graphs.length;
	if(graphAmount == 1){
		graphs = graphs.concat(graphs[0]);
	}
	let processEdges = [];
	edges.forEach(function(edge){
		let source = graphs[1].$id( `${edge.source}` );
		let target = graphs[1].$id( `${edge.target}` );

		if (!graphs[1].$id( `${edge.id}` ).empty() || source.empty() || target.empty()) {return;}

		// If the target is explicitly marked as something we read from
		// (e.g., the by-convention read-from pipe), reverse the edge's direction.
		if (source.data().type == 'process' && target.data().end == 'R') {
			let swap = edge.source;
			edge.source = edge.target;
			edge.target = swap;
		}
		processEdges = processEdges.concat({classes: edge.type, data: edge,});
	});
	if(graphAmount == 1){graphs.pop();}
	for(let graph of graphs){
		graph.add(processEdges);
	}
}

//
// Save the current graph in a JSON format.
//
export function save(graph, filename) {
	let blob = new Blob([ JSON.stringify(graph.json()) ], { type: 'text/json' });

	let a = document.createElement('a');

	a.download = `${filename}.json`;
	a.href= window.URL.createObjectURL(blob);
	a.style.display = 'none';

	document.body.appendChild(a);

	a.click();
}

//
// Load a Cytograph JSON representation into an object with a 'graph' property.
//
export function load(file, graph, highLightedIDs = [], fn) {
	let reader = new FileReader();
	let loadedHighLighted = [];
	reader.addEventListener('loadend', function() {
		let data = JSON.parse(reader.result);
		data.container = graph.container();
		data.layout = { name: 'preset' };
		graph = cytoscape(data);

		highLightedIDs.forEach(function(id){
			let ele = graph.$id( id );
			if(ele.length > 0 && !ele.hasClass('important')){
				ele.addClass('important');
			}
		});
		graph.$('.important').forEach(function(ele){
			loadedHighLighted = loadedHighLighted.concat(ele.attr('id'));
		});
		let highDiff = $(loadedHighLighted).not(highLightedIDs).get();
		fn(graph, highDiff);
	});

	reader.readAsText(file);
}

//
// Apply a named graph layout algorithm to a graph.
//
export function layout(graph, algorithm) {
	graph.layout({
		name: algorithm,
		rankDir: 'LR',
		animate: false
	})
	.run();
};

export function swapStyle(isDark, graphs=null){
	switch(isDark){
		case(true):
			connection = connNeon;
			proc = procNeon;
			file_version = FileNeon;
			edit_session = editNeon;
			cadets_machine = cMachineNeon;
			machine_external = machineNeon;
			pipe = pipeNeon;
			socket = SocketNeon;
			fileCompoundColor = "#000";
			pipeCompoundColor = "#000";
			socketCompoundColor = "#000";
			importantColor = "#996b00";
			textColor = "#e2e2e2";
		break;
		case(false):
			connection = connectionOrig;
			proc = procOrig;
			file_version = file_versionOrig;
			edit_session = edit_sessionOrig;
			cadets_machine = cadets_machineOrig;
			machine_external = machine_externalOrig;
			pipe = pipeOrig;
			socket = socketOrig;
			fileCompoundColor = "#dc9";
			pipeCompoundColor = "#076928";
			socketCompoundColor = "#999";
			importantColor = "orange";
			textColor = "black";
		break;
	}
	if(graphs == null){return;}
	load_graph_style(graphs);
}
""





//
// Load a Cytograph CSS file and apply it to a graph.
//
// Unfortunately this is hard to do statically.
//
function load_graph_style(graphs) {
	for (let g of graphs) {
		g.style().fromString(
			`core {
				active-bg-color: #7a7a7a; }

			edge {
				curve-style: bezier;
				font-family: Avenir, Helvetica Neue, Helvetica, sans-serif;
				source-arrow-shape: none;
				mid-target-arrow-shape: triangle;
				arrow-scale: 2;
				width: 8;
				text-halign: center;
				text-valign: center;
				text-outline-width: 2;
				color: blue; }

			edge.parent {
				line-style: dotted;
				width: 8;
				target-arrow-color: #366;
				mid-target-arrow-color: #366;
				line-color: #366;
				text-outline-color: #366; }

			edge.file-change {
				line-style: dotted;
				target-arrow-color: #633;
				mid-target-arrow-color: #633;
				line-color: #633;
				text-outline-color: #633; }

			edge.io {
			 	target-arrow-color: #633;
			 	mid-target-arrow-color: #633;
			 	line-color: #633;
			 	text-outline-color: #633; }

			edge.comm {
				line-style: dashed;
				target-arrow-color: #633;
				mid-target-arrow-color: #633;
				line-color: #633;
			 	text-outline-color: #633; }

			edge.proc-change {
				line-style: dashed;
				target-arrow-color: #366;
				mid-target-arrow-color: #366;
				line-color: #366;
				text-outline-color: #366; }

			edge.proc-metadata {
				line-style: dotted;
				target-arrow-color: #366;
				mid-target-arrow-color: #366;
				line-color: #366;
				text-outline-color: #366; }

			edge.inf {
				line-style: dotted;
				target-arrow-color: #633;
				mid-target-arrow-color: #633;
				line-color: #633;
				text-outline-color: #633; }

			edge.describes {
				target-arrow-color: #8c4a00;
				mid-target-arrow-color: #8c4a00;
				line-color: #8c4a00;
				text-outline-color: #8c4a00; }

			node {
				content: data(label);
				font-family: Inconsolata, Source Code Pro, Consolas, monospace;
				border-style: solid;
				border-width: 2;
				color: ${textColor};
				text-outline-color: #eee;
				text-outline-opacity: 0.9;
				text-outline-width: 0;
				text-halign: center;
				text-valign: bottom;
				text-wrap: wrap;
				text-max-width: 8em;
				height: 4em;
				width: 4em;
				background-fit: contain;
				background-position-x: 0;
				background-position-y: 0; }

			node:selected {
				  overlay-color: #720d00;
				  overlay-opacity: 0.5;
				  overlay-padding: 5; }

			node:active {
				  overlay-color: #474747;
				  overlay-opacity: 0.5;
				  overlay-padding: 5; }

			node.annotation {
				shape: octagon; }

			node.annotationActive {
				background-color: #720d00; }

			node.important {
				overlay-color: ${importantColor};
				overlay-padding: 64;
				overlay-opacity: 0.50; }
			
			node.connection {
				shape: rectangle;
				background-image: ${connection};
				background-opacity: 0;
				border-opacity: 0;
				width: 135px;
				height: 135px; }

			node.process {
				shape: ellipse;
				background-image: ${proc};
				background-opacity: 0;
				border-opacity: 0;
				width: 135px;
				height: 135px; }

			node.file {
				background-color: ${fileCompoundColor};
				background-opacity: 0.25;
				border-color: #633; }

			node.file-version {
				shape: rectangle;
				content: '';
				text-opacity: 0;
				background-image: ${file_version};
				background-opacity: 0;
				border-width: 0; }

			node.edit {
				background-color: #000;
				background-opacity: 0.25;
				border-color: #633; }

			node.edit-session {
				shape: rectangle;
				content: '';
				text-opacity: 0;
				background-image: ${edit_session};
				background-opacity: 0;
				border-width: 0; }

			node.global {
				shape: triangle; }

			node.machine {
				font-size: 48pt;
				text-valign: top;
				shape: rectangle;
				padding: 4em;
				width: 180px;
				height: 180px;
				background-color: #eee;
				background-image: ${cadets_machine};
				background-fit: contain;
				background-opacity: 0;
				border-width: 0;
				color: #0A3A62;
				font-weight: bold;
				text-background-opacity: 0;
				text-outline-color: white;
				text-outline-width: 3; }

			node.machine:parent {
				background-image-opacity: 0;
				background-fit: none;
				background-height: 128px;
				background-width: 128px;
				background-opacity: 1;
				border-width: 2;
				min-height: 128px;
				min-width: 128px; }

			node.machine.external {
				text-margin-y: 0.25em;
				padding: 1em;
				background-image: ${machine_external};
				width: 135px;
				height: 135px; }

			node.pipe {
				content: data(label);
				background-color: ${pipeCompoundColor};
				background-opacity: 0.25;
				border-color: #076928; }

			node.pipe-endpoint {
				content: '';
				font-size: 0;
				text-opacity: 0;
				shape: rectangle;
				background-image: ${pipe};
				background-color: white;
				background-opacity: 0;
				border-width: 0; }

			node.sock {
				background-color: ${socketCompoundColor};
				background-opacity: 0.5;
				border-color: #999;
				border-opacity: 1; }

			node.socket-version {
				shape: rectangle;
				background-image: ${socket};
				background-fit: contain;
				background-opacity: 0;
				border-opacity: 0;
				font-size: 0;
				text-opacity: 0; }`
	 	).update();
	 }
}

//
// Extract graphical metadata about a graph node (icon and label) that isn't
// really appropriate to serve from OPUS/Neo4j.
//
export function node_metadata(node) {
	let metadata = null;
	let timestamp = null;
	switch (node.type) {
		case 'connection':
			metadata = {
				icon: 'connectdevelop',
				label: node.endpoints.join(' '),
			};
			timestamp = node['timestamp'];
			break;

		case 'machine':
			metadata = {
				icon: 'desktop',
				label: node.name.join(' / '),
			};
			timestamp = node['timestamp'];
			if (metadata.label == '') {
					metadata.label = node.ips.join(' / ');
			}
			break;

		case 'pipe':
			metadata = {
				icon: 'circle',
				label: Array(node.names).join(', '),
			};
			break;

		case 'pipe-endpoint':
			metadata = {
				icon: 'circle',
				label: node.hash,
			};
			timestamp = node['timestamp'];
			break;

		case 'process':
			metadata = {
				icon: 'terminal',
				label: node.cmdline,
			};
			timestamp = node['timestamp'];
			break;

		case 'file':
			metadata = {
				icon: 'file-o',
				label: Array(node.names).join(' '),
			};
			break;

		case 'file-version':
			metadata = {
				icon: 'file-o',
				label: parseNodeName(node.name),
			};
			timestamp = node['timestamp'];
			break;

		case 'edit':
			metadata = {
				icon: 'file-o',
				label: Array(node.names).join(' '),
			};
			timestamp = node['timestamp'];
			break;

		case 'edit-session':
			metadata = {
				icon: 'file-o',
				label: parseNodeName(node.name),
			};
			timestamp = node['timestamp'];
			break;

		case 'global':
			metadata = {
				icon: 'file-o',
				label: parseNodeName(node.name),
			};
			timestamp = node['timestamp'];
			break;

		case 'process-meta':
			metadata = {
				icon: 'terminal',
				label: 'metadata change',
			};
			timestamp = node.meta_ts;
			break;

		case 'socket-version':
			metadata = {
				icon: 'plug',
				label: parseNodeName(node[PVMvLexicon.socket_name]),
			};
			timestamp = node['timestamp'];
			break;
		case 'sock':
			metadata = {
				label: node['label'],
			};
			timestamp = node['timestamp'];
			break;
		case 'annotation':
			metadata = {
				label: node['title'],
			};
			timestamp = node['timestamp'];
			break;

	default:
		console.log(`unknown node type In graphing.js - node_metadata node data:`);
		console.log(node);
		return {
			icon: 'question',
			label: 'unknown',
		};
	}

	if (timestamp) {
		metadata.timestamp =
			moment.unix(timestamp / 1000000000).format();
	} else {
		metadata.timestamp = '';
	}

	if (metadata.label == '') {
		metadata.label = 'node';
	}

	return metadata;
}

export function setPVMVersion(PVMv){
	pvm_version = PVMv;
	switch(pvm_version['low']){
		case(1):
			PVMvLexicon = {'socket_name' : 'name'};
			break;
		case(2):
			PVMvLexicon = {'socket_name' : 'ip'};
			break;
		default:
			console.log(`unknown pvm_version: ${PVMv} in graphing.js setPVMVersion`);
	}
}

function parseNodeName(name, joiner=' / '){
	if(Array.isArray(name)){
		return name.join(joiner);
	}
	else{
		return name;
	}
}

const graphing ={
	save,
	node_metadata,
	layout,
	load,
	add_node,
	add_node_batch,
	create,
	add_edge,
	add_edge_batch,
	setPVMVersion,
	swapStyle,
}

export default graphing;