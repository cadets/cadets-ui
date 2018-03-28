// require('cytoscape-autopan-on-drag')(cytoscape);

import $ from './../node_modules/jquery/dist/jquery.js';
import cytoscape from './../node_modules/cytoscape/dist/cytoscape.min.js';
import moment from './../node_modules/moment/moment.js';

import connection from './img/connection.png';
import proc from './img/proc.png';
import file_version from './img/file-version.png';
import edit_session from './img/edit-session.png';
import cadets_machine from './img/cadets-machine.svg';
import machine_external from './img/machine-external.svg';
import pipe from './img/pipe.png';
import socket from './img/socket.png';

var pvm_version = null;
var PVMvLexicon = null;

//
// Create a new graph.
//
export function create(container) {
	let graph = cytoscape({
		container: document.getElementById(container),
		boxSelectionEnabled: true,
	});

	load_graph_style([ graph ]);

	return graph;
}

//
// Add a node to a graph.
//
export function add_node(data, graph, renderedPosition = null, highLightedIDs = []) {
	add_node_batch([data], graph, renderedPosition = null, highLightedIDs = []);
}


export function add_node_batch(nodes, graph, renderedPosition = null, highLightedIDs = []) {
	let parsedNodes = [];
	let nodesToHighLight = [];
	nodes.forEach(function(data){
		// Have we already imported this node?

		if (!graph.nodes(`[id="${data.id}"]`).empty()) {
			return;
		}

		// When importing things with abstract containers (e.g., file versions),
		// draw a compound node to show the abstraction and simplify the versions.
		if (data.uuid && (
				[ 'file-version', 'pipe-endpoint', 'socket-version', 'edit-session'].indexOf(data.type)
					!= -1
				)) {
			let compound = graph.nodes(`[id="${data.uuid}"]`);
			let type = data.type.substr(0, 4);

			let name = data.name;
			if (name == null) {
				name = new Set().add(data.hash);
			}

			// Add file descriptors if we have them.
			if (data.fds) {
				for(let fd in data.fds){
					name = name.concat('FD ' + fd)
				}
			}

			if (compound.empty()) {
				add_node({
					id: data.uuid,
					type: type,
					label: Array.from(name).join(', '),
					names: name,
					'parent': data['parent'],
				}, graph, renderedPosition);
			} else {
				let existing = compound.data();
				existing.names = new Set([...existing.names, ...name]);
				existing.label = Array.from(existing.names).join(' ');
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
	graph.add(parsedNodes);
	nodesToHighLight.forEach(function(id){
		graph.$id( id ).addClass('important');
	})
}

export function add_edge(data, graph) {
	add_edge_batch([data], graph);
}

export function add_edge_batch(edges, graph){
	let processEdges = [];
	edges.forEach(function(edge){
		let source = graph.$id( edge.source );
		let target = graph.$id( edge.target );

		if (!graph.$id( edge.id ).empty() || source.empty() || target.empty()) {return;}

		// If the target is explicitly marked as something we read from
		// (e.g., the by-convention read-from pipe), reverse the edge's direction.
		if (source.data().type == 'process' && target.data().end == 'R') {
			let swap = edge.source;
			edge.source = edge.target;
			edge.target = swap;
		}
		processEdges = processEdges.concat({classes: edge.type, data: edge,});
	});
	graph.add(processEdges);
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

//
// Load a Cytograph CSS file and apply it to a graph.
//
// Unfortunately this is hard to do statically.
//
function load_graph_style(graphs) {
	for (let g of graphs) {
		g.style().fromString(
			`core {
				active-bg-color: #333; }

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
				color: white; }

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

			node {
				content: data(label);
				font-family: Avenir, Helvetica Neue, Helvetica, sans-serif;
				border-style: solid;
				border-width: 2;
				color: black;
				text-outline-color: #eee;
				text-outline-opacity: 0.9;
				text-outline-width: 6;
				text-halign: center;
				text-valign: bottom;
				text-wrap: wrap;
				text-max-width: 10em;
				height: 4em;
				width: 4em;
				background-fit: contain;
				background-position-x: 0;
				background-position-y: 0; }

			node.important {
				overlay-color: orange;
				overlay-padding: 64;
				overlay-opacity: 0.50; }
				node:selected {
				overlay-color: #333;
				overlay-padding: 10;
				overlay-opacity: 0.25; }

			node.connection {
				shape: rectangle;
				background-image: ${connection};
				background-color: white;
				color: white;
				text-background-opacity: 0;
				text-outline-color: black;
				text-outline-width: 3; }

			node.process {
				shape: ellipse;
				background-color: #333;
				background-image: ${proc};
				border-color: #333;
				font-family: Inconsolata, Source Code Pro, Consolas, monospace; }

			node.file {
				background-color: #dc9;
				background-opacity: 0.25;
				border-color: #633;
				color: #633; }

			node.file-version {
				shape: rectangle;
				content: '';
				text-opacity: 0;
				background-image: ${file_version};
				background-opacity: 0;
				border-width: 0; }

			node.edit {
				background-color: #dc9;
				background-opacity: 0.25;
				border-color: #633;
				color: #633; }

			node.edit-session {
				shape: rectangle;
				content: '';
				text-opacity: 0;
				background-image: ${edit_session};
				background-opacity: 0;
				border-width: 0; }

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
				width: 80px;
				height: 80px;
				background-image: ${machine_external};
				background-image-opacity: 1; }

			node.pipe {
				content: data(label);
				background-color: #076928;
				background-opacity: 0.25;
				border-color: #076928;
				color: #076928; }

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
				background-color: #999;
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
	 	);
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

	default:
		console.log('unknown node type: ' + node.type);
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
			console.log('unknown pvm_version in graphing.js setPVMVersion');
	}
}

function parseNodeName(name){
	if(Array.isArray(name)){
		return name.join(' / ');
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
}

export default graphing;