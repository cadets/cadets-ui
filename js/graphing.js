// Cytoscape core library and layouts:
// const cytoscape = require('js/cytoscape.js');
// require('cytoscape-autopan-on-drag')(cytoscape);
// require('cytoscape-cose-bilkent')(cytoscape);
// require('cytoscape-dagre')(cytoscape);

// Our Cytoscape styling:
//require('./cytoscape.styl');

//const moment = require('moment');


//
// Create a new graph.
//
function create(container) {
	var graph = cytoscape({
		container: document.getElementById(container),
		boxSelectionEnabled: true,
	});

	load_graph_style([ graph ]);

	// //graph.add_node = function(node) { add_node(node, graph); };

	return graph;
}

//
// Add a node to a graph.
//
function add_node(data, graph, renderedPosition = null) {
	// Have we already imported this node?
	if (!graph.nodes(`[id="${data.id}"]`).empty()) {
		return;
	}

	// When importing things with abstract containers (e.g., file versions),
	// draw a compound node to show the abstraction and simplify the versions.
	if (data.uuid && (
			[ 'file-version', 'pipe-endpoint', 'socket-version', ].indexOf(data.type)
				!= -1
			)) {
		let compound = graph.nodes(`[id="${data.uuid}"]`);
		let type = data.type.substr(0, 4);

		let names = data.names;
		if (names == null) {
			names = new Set().add(data.hash);
		}

		// Add file descriptors if we have them.
		if (data.fds) {
			data.fds.forEach(function(fd) { names.add('FD ' + fd); });
		}

		if (compound.empty()) {
			add_node({
				id: data.uuid,
				type: type,
				label: Array.from(names).join(', '),
				names: names,
				'parent': data['parent'],
			}, graph, renderedPosition);
		} else {
			let existing = compound.data();
			existing.names = new Set([...existing.names, ...names]);
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

	graph.add(node);
}


//
// Load a Cytograph JSON representation into an object with a 'graph' property.
//
function load(file, graphContainer) {
	let reader = new FileReader();
	reader.addEventListener('loadend', function() {
		let data = JSON.parse(reader.result);
		data.container = graphContainer.graph.container();
		data.layout = { name: 'preset' };
		graphContainer.graph = cytoscape(data);
	});

	reader.readAsText(file);
}

//
// Load a Cytograph CSS file and apply it to a graph.
//
// Unfortunately this is hard to do statically.
//
function load_graph_style(graphs) {
	$.ajax('css/cytoscape.css', {
		dataType: 'text',
		mimeType: 'text/css',
		success: function(result) {
			for (let g of graphs) {
				g.style(result);
			}
		}
	});
}

//
// Apply a named graph layout algorithm to a graph.
//
function layout(graph, algorithm) {
	graph.layout({
		name: algorithm,
		rankDir: 'LR',
		animate: false,
	})
	.run();
};

//
// Extract graphical metadata about a graph node (icon and label) that isn't
// really appropriate to serve from OPUS/Neo4j.
//
function node_metadata(node) {
	let metadata = null;
	let timestamp = null;

	switch (node.type) {
		case 'connection':
			metadata = {
				icon: 'connectdevelop',
				label: node.endpoints.join(' '),
			};
			timestamp = node.timestamp;
			break;

		case 'machine':
			metadata = {
				icon: 'desktop',
				label: node.names.join(' / '),
			};
			timestamp = node.first_seen;
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
			timestamp = node.creation;
			break;

		case 'process':
			metadata = {
				icon: 'terminal',
				label: node.cmdline,
			};
			timestamp = node.last_update;
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
				label: node.names.join(' / '),
			};
			timestamp = node.creation;
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
				label: node.names.join(' / '),
			};
			timestamp = node.creation;
			break;

	default:
		console.log('unknown node type: ' + node.type);
		return {
			icon: 'question',
			label: 'unknown',
		};
	}

	if (timestamp) {
		//****************** remove time temp
		metadata.timestamp =
			moment.unix(timestamp / 1000000000).format('HH:mm[h] D MMM');
	} else {
		metadata.timestamp = '';
	}

	if (metadata.label == '') {
		metadata.label = '???';
	}

	return metadata;
}

//
// Save the current graph in a JSON format.
//
function save(graph, filename) {
	let blob = new Blob([ JSON.stringify(graph.json()) ], { type: 'text/json' });

	let a = document.createElement('a');

	a.download = `${filename}.json`;
	a.href= window.URL.createObjectURL(blob);
	a.style.display = 'none';

	document.body.appendChild(a);

	a.click();
}

// module.exports = {
//   create: create,

//   node_metadata: node_metadata,

//   load: load,
//   save: save,
// };
