import _ from 'lodash';
import $ from './../node_modules/jquery/dist/jquery.js';
import vex from './../node_modules/vex-js/dist/js/vex.combined.min.js';
import cytoscape from './../node_modules/cytoscape/dist/cytoscape.min.js';
import cxtmenu from './../node_modules/cytoscape-cxtmenu/cytoscape-cxtmenu.js';
import moment from './../node_modules/moment/moment.js';
import GoldenLayout from './../node_modules/golden-layout/dist/goldenlayout.min.js';

//import './../node_modules/hashids/dist/hashids.min.js';
import dagre from './../node_modules/cytoscape-dagre/cytoscape-dagre.js';
import cose_bilkent from './../node_modules/cytoscape-cose-bilkent/cytoscape-cose-bilkent.js';

import './css/style.css';
import './../node_modules/vex-js/dist/css/vex.css';
import './../node_modules/vex-js/dist/css/vex-theme-wireframe.css';
import './../node_modules/golden-layout/src/css/goldenlayout-base.css';
import './../node_modules/golden-layout/src/css/goldenlayout-dark-theme.css';

var graphingAPI = require('./graphing.js');
var neo4jQueries = require('./neo4jQueries.js');
var goldenLayoutHTML = require('./goldenLayoutHTML.js');

cytoscape.use( cxtmenu );
cytoscape.use( dagre );
cytoscape.use( cose_bilkent );

//Build Html document

let element = htmlBody();
document.body.appendChild(element);

if (module.hot) {
	module.hot.accept('./graphing.js', function() {
		console.log('Accepting the updated graphing module!');
		document.body.removeChild(element);
		element = component();
		document.body.appendChild(element);
	})
	module.hot.accept('./neo4jQueries.js', function() {
		console.log('Accepting the updated graphing module!');
		document.body.removeChild(element);
		element = component();
		document.body.appendChild(element);
	})
	module.hot.accept('./neo4jParser.js', function() {
		console.log('Accepting the updated graphing module!');
		document.body.removeChild(element);
		element = component();
		document.body.appendChild(element);
	})
	module.hot.accept('./goldenLayoutHTML.js', function() {
		console.log('Accepting the updated graphing module!');
		document.body.removeChild(element);
		element = component();
		document.body.appendChild(element);
	})
}

//Build Html document end

//Global variables

var currMouseX = 0;
var currMouseY = 0;

var inspector;
var worksheets = {};

var selectedWorksheet = 0;

var inspecteeBackStack = [];
var inspecteeForwardStack = [];

var inspectFiles = false;
var inspectSockets = false;
var inspectPipes = false;
var inspectProcessMeta = false;

var nodeSearchsheetContainer;
var worksheetContainer = [];
var inspectorContainer;
var detailsContainer;
var neighboursContainer;

var inspectorElementBuffer;//This is to hold on to inspects that are larger then inspectorDisplayAmount
var currInspectorBufferIndex = 1;
var inspectorDisplayAmount = 49;//The max number of nodes shown in the inspector at one time
var limitNodesForDagre = 100;//The max number of nodes the inspector will use the Dagre layout

var maxImportLength = 500;//The max number of nodes that can be imported into a worksheet in one action
var amountShownInNodeList = 100;//The max number of nodes that are display in the NodeSearchsheet

var workSheetLayout = goldenLayoutHTML.intiGoldenLayoutHTML();

var worksheetChildCxtMenu = ( 
{
	menuRadius: 140,
	separatorWidth: 5,
	selector: 'node:childless',
	commands: [
		{
			content: 'Inspect',
			select: function(ele){
				inspectAsync(ele.data('id'));
			}
		},
		{
			content: 'Import neighbours',
			select: function(ele){
				openSubMenu(function(){
					import_neighbours_into_worksheet(ele.data('id'));
				});
			}
		},
		// {
		// 	content: 'Import successors',
		// 	select: function(ele){
		// 		openSubMenu(function(){
		// 			successors(ele.data('id'));
		// 		});
		// 	}
		// },
		{
			content: 'Highlight',
			select: function(ele){
				toggle_node_importance(ele.data("id"));
			}
		},
		{
			content: 'Files read',
			select: function(ele){//TODO: basically same as Commands turn into one function
				let id = ele.data('id');
				neo4jQueries.file_read_query(id, function(results){
					let files = document.createElement("ul");
					let header = document.createElement("h2");
					header.innerHTML = `<font>Files read by ${id}:</font>`
					files.appendChild(header);
					results.forEach(function(result) {
						let file = document.createElement("li");
						file.innerHTML = `<a>${result.properties.name}</a>`;
						file.onclick =(function() {
							openSubMenu(function(){
								inspect_and_importAsync(result.identity.low);
							}, true, true);
						});
						files.appendChild(file);
					});
					vex.dialog.alert({
						unsafeMessage: files,
						className: 'vex-theme-wireframe'
					});
				});
			}
		},
		{
			content: 'Commands',
			select: function(ele){
				var id = ele.data('id');
				neo4jQueries.cmd_query(id, function(results) {
					let files = document.createElement("ul");
					let header = document.createElement("h2");
					header.innerHTML = `<font>Commands run by node ${id}:</font>`;
					files.appendChild(header);
					results.forEach(function(result) {
						let file = document.createElement("li");
						file.innerHTML = `<a>${result.cmdline}</a>`;
						file.onclick =(function() {
							openSubMenu(function(){
								inspect_and_importAsync(result.id);
							}, true, true);
						});
						files.appendChild(file);
					});
					vex.dialog.alert({
						unsafeMessage: files,
						className: 'vex-theme-wireframe'
					});
				});
			}
		},
		{
			content: 'Remove neighbours',
			select: function(ele){
				openSubMenu(function(){
					remove_neighbours_from_worksheet(ele.data("id"));
				}, false);
			}
		},
		{
			content: 'Remove',
			select: function(ele){
				openSubMenu(function(){
					let node = worksheets[`${selectedWorksheet}`].graph.$id(ele.data("id"));
					node.remove();
					removeEmptyParents(node.parents());
				}, false);
			}
		},
	]
});var worksheetParentCxtMenu = ( 
{
	menuRadius: 70,
	separatorWidth: 0,
	selector: 'node:parent',
	commands: [
		{
			content: 'Remove',
			select: function(ele){
				openSubMenu(function(){
					let node = worksheets[`${selectedWorksheet}`].graph.$id(ele.data("id"));
					node.remove();
					removeEmptyParents(node.parents());
				}, false);
			}
		},
	]
});

//Global variables end

//Main

workSheetLayout.registerComponent( 'NodeSearchsheet', function( container, state ){
	container._config.isClosable = false;
	container.getElement().html(state.text);
	nodeSearchsheetContainer = container;
});
workSheetLayout.registerComponent( `Worksheet`, function( container, state ){
	container.setTitle(`Worksheet_${getWorksheetCount()}`);
	container.worksheetID = getWorksheetCount();
	container.getElement().html(state.text);
	worksheetContainer = worksheetContainer.concat(container);
});
workSheetLayout.registerComponent( 'Inspector', function( container, state ){
	container._config.isClosable = false;
	container.getElement().html(state.text);
	inspectorContainer = container;
});
workSheetLayout.registerComponent( 'Details', function( container, state ){
	container._config.isClosable = false;
	container.getElement().html(state.text);
	detailsContainer = container;
});
workSheetLayout.registerComponent( 'Neighbours', function( container, state ){
	container._config.isClosable = false;
	container.getElement().html(state.text);
	neighboursContainer = container;
});

workSheetLayout.init();

//Main end

//Events

//Main Events

workSheetLayout.on('initialised', function(){
	if(document.getElementById("NodeSearchsheet") != null){
		neo4jQueries.neo4jLogin();
	}
	if(document.getElementById("inspectorGraph") != null){
		$("body").on("contextmenu", function(e){
			return false;
		});
		createInspector();
	}
	if(document.getElementById(`worksheetGraph${getWorksheetCount()}`) != null){
		createWorksheet();
	}

	document.getElementById(`toggleNodeSearchsheet`).onclick = function () {
		if(document.getElementById("NodeSearchsheet") != null){
			document.getElementById("toggleNodeSearchsheet").innerHTML = "Open NodeSearchsheet";
			nodeSearchsheetContainer._config.isClosable = true;
			nodeSearchsheetContainer.close();
		}
		else{
			document.getElementById("toggleNodeSearchsheet").innerHTML = "Close NodeSearchsheet";
			goldenLayoutHTML.addNodeSearchsheet(workSheetLayout);
		}
	};

	// document.getElementById(`loadWorksheet`).onclick = function () {
	// 	//console.log(this);
	// 	addNewWorksheet();
	// 	graphingAPI.load(this.files[0], worksheets[`${getWorksheetCount() -1}`].graph, worksheetChildCxtMenu);
	// };

	document.getElementById(`newWorksheet`).onclick = function () {
		addNewWorksheet();
	};
});

workSheetLayout.on('stackCreated', function(stack) {
			stack.on('activeContentItemChanged', function(contentItem) {
				contentItem.parent.header.controlsContainer.find('.lm_popout').hide();
			}
		);
	}
);

window.onresize = function(){
	workSheetLayout.updateSize();
}

document.body.onmousemove = findMouseCoords;

//Main Events end

//Worksheet Events

workSheetLayout.on(`WorksheetContainerCreated`, function(fn){
	createWorksheet();
	fn();
});

workSheetLayout.on(`itemDestroyed`, function(item){
	if(item.componentName == "Worksheet"){
		delete worksheets[`${item.container.worksheetID}`];
	}
});

//Worksheet Events end

//Inspector Events

workSheetLayout.eventHub.on('updateInspectTargets', function(files, sockets, pipes, meta){
	updateInspectTargets(files, sockets, pipes, meta);
});

//Inspector Events end

//NodeSearchsheet Events

workSheetLayout.on(`NodeSearchsheetContainerCreated`, function(){
	$('input[id *= "filter"],select[id *= "filter"]').on('change', update_nodelist);
});

//NodeSearchsheet Events end

//Popout Events 

workSheetLayout.on('windowOpened', function( id ){
	workSheetLayout.eventHub.emit('inspectorWindowOpened', lastInspectedId, neo4jQueries);
});

var once = false; // should find a better way to make sure windows only load once

workSheetLayout.eventHub.on('inspectorWindowOpened', function( id, currNeo4jQueries ){
	if(document.getElementById("NodeSearchsheet") != null && !once){
		once = true;
		workSheetLayout.eventHub.emit('updateInspectTargets',
										$('#inspectFiles').is(':checked'),
										$('#inspectSockets').is(':checked'),
										$('#inspectPipes').is(':checked'),
										$('#inspectProcessMeta').is(':checked'));
	}
	if(document.getElementById("inspectorGraph") != null){
		neo4jQueries = currNeo4jQueries;
		lastInspectedId = id;
		inspectAsync(id);
	}
});

workSheetLayout.on('windowClosed', function( id ){
	once = false;
	if(document.getElementById("inspectorGraph") != null){
		createInspector();
		inspect_node(lastInspectedId);
	}
});

workSheetLayout.eventHub.on('inspect', function( id ){
	if(document.getElementById("inspectorGraph") != null){
		inspect_node(id);
	}
});

workSheetLayout.eventHub.on('import_into_worksheet', function( id ){
	if(document.getElementById(`worksheetGraph${selectedWorksheet}`) != null){
		import_into_worksheet(id);
	}
});

workSheetLayout.eventHub.on('import_neighbours_into_worksheet', function( id ){
	if(document.getElementById(`worksheetGraph${selectedWorksheet}`) != null){
		import_neighbours_into_worksheet(id);
	}
});

//Popout Events end

//Events end

//Functions

//Worksheet Functions

function createWorksheet(){
	let index = getWorksheetCount();
	let worksheetGraph = graphingAPI.create(`worksheetGraph${index}`);

	worksheets[`${index}`] = { graph: worksheetGraph};

	worksheetContainer[index].on('resize', function(){
		refreshGraph(worksheets[`${index}`].graph);
	})

	worksheetGraph.cxtmenu(worksheetChildCxtMenu);
	worksheetGraph.cxtmenu(worksheetParentCxtMenu);

	//setRefreshGraphOnElementShow(`worksheet${index}`, worksheetGraph);

	$('input[id *= "filter"],select[id *= "filter"]').on('change', update_nodelist);

	document.getElementById(`loadGraph${index}`).onchange = function () {
		graphingAPI.load(this.files[0], worksheets[`${index}`].graph, worksheetChildCxtMenu, function(newGraph){
			worksheets[`${index}`].graph = newGraph;
			worksheets[`${index}`].graph.cxtmenu(worksheetChildCxtMenu);
			worksheets[`${index}`].graph.cxtmenu(worksheetParentCxtMenu);
		});
	};

	document.getElementById(`saveGraph${index}`).onclick = function () {
		graphingAPI.save(worksheets[`${index}`].graph, document.getElementById(`saveFilename${index}`).value);
	};

	document.getElementById(`reDagre${index}`).onclick = function () {
		graphingAPI.layout( worksheets[`${index}`].graph, 'dagre');
	};

	document.getElementById(`reCose-Bilkent${index}`).onclick = function () {
		graphingAPI.layout( worksheets[`${index}`].graph, 'cose-bilkent');
	};
	goldenLayoutHTML.incrementWorksheetCount();
}

function addNewWorksheet(){
	goldenLayoutHTML.addWorksheet(workSheetLayout, function(){
		const index = getWorksheetCount() -1;
		let temp = workSheetLayout.root.contentItems[ 0 ].contentItems;
		temp[ temp.length-1 ].on('resize', function(){
			refreshGraph(worksheets[`${index}`].graph);
		});
	});
}

function getWorksheetCount(){
	return goldenLayoutHTML.getWorksheetCount();
}

function remove_neighbours_from_worksheet(id) {
	let parents = [];
	let node = worksheets[`${selectedWorksheet}`].graph.$id(id);
	// First check to see if this is a compound node.
	let children = node.children();
	if (!children.empty()) {
		children.forEach(function (node) { worksheets[`${selectedWorksheet}`].graph.remove(node); });
		node.remove();
		return;
	}

	// Otherwise, remove edge-connected neighbours that aren't highlighted.
	node.connectedEdges().connectedNodes().filter(function(ele) {
		parents = parents.concat(ele.parents());
		return !ele.hasClass('important');
	}).remove();
	removeEmptyParents(parents);
}

function toggle_node_importance(id) {
	let nodes = [];
	for(let i in worksheets){
		nodes = nodes.concat(worksheets[i].graph.nodes(`node#${id}`));
	}
	nodes.forEach( function(ele){
		if (ele.hasClass('important')) {
			ele.removeClass('important');
		} else {
			ele.addClass('important');
		}
	});
}

//
// Define what it means to show "successors" to a node.
//
function successors(id) {
	let graph = worksheets[`${selectedWorksheet}`].graph;

	// Display the node's details in the inspector "Details" panel.
	get_successors(id, function(result) {

		let position = {
			x: graph.width() / 2,
			y: graph.height() / 2,
		};

		for (let n of result.nodes) {
			graphingAPI.add_node(n, graph, position);
		}

		let elements = graph.elements();
		for (let e of result.edges) {
			graphingAPI.add_edge(e, graph);
		}
	});
}

//
// Fetch successors to a node, based on some user-specified filters.
//
function get_successors(id, fn) {
	return neo4jQueries.successors_query(id,
										100,
										inspectFiles,
										inspectSockets,
										inspectPipes,
										inspectProcessMeta,
										fn);
}

//Worksheet Functions end

//Inspector Functions

function createInspector(){
	let inspectorGraph = graphingAPI.create('inspectorGraph');

	inspector = {
		detail: $('#inspector-detail'),
		neighbours: $('#neighbour-detail'),
		graph: inspectorGraph,
	};
	inspector.graph.inspectee = null;

	inspectorContainer.on('resize', function(){
		refreshGraph(inspector.graph);
	});

	setRefreshGraphOnElementShow('inspectorGraph', inspector.graph);

	inspectorGraph.cxtmenu({
		selector: 'node:childless',
		commands: [
			{
				content: 'Import node',
				select: function(ele){
					openSubMenu(function(){
						import_into_worksheetAsync(ele.data('id'));
					});
				}
			},
			{
				content: 'Import neighbours',
				select: function(ele){
					openSubMenu(function(){
						import_neighbours_into_worksheetAsync(ele.data('id'));
					});
				}
			},
			{
				content: 'Inspect',
				select: function(ele){
					inspectAsync(ele.data("id"));
				}
			},
			{
				content: 'Import and Inspect',
				select: function(ele){
					openSubMenu(function(){
						inspect_and_import(ele.data('id'));
					});
				}
			},
		]
	});

	$('input[id *= "inspect"]').on('change', function() {
		workSheetLayout.eventHub.emit('updateInspectTargets',
										$('#inspectFiles').is(':checked'),
										$('#inspectSockets').is(':checked'),
										$('#inspectPipes').is(':checked'),
										$('#inspectProcessMeta').is(':checked')
		 );
		if (inspector.graph.inspectee != null) {
			inspect_node(inspector.graph.inspectee.id());
		}
	});

	document.getElementById(`inspectLast`).onclick = function () {
		if(inspecteeBackStack.length > 0){
			inspecteeForwardStack.push(inspector.graph.inspectee.id());
			inspect_node(inspecteeBackStack.pop());
		}
	};

	document.getElementById(`inspectForward`).onclick = function () {
		if(inspecteeForwardStack.length >= 1){
			inspecteeBackStack.push(inspector.graph.inspectee.id());
			inspect_node(inspecteeForwardStack.pop());
		}
	};
}

function inspect_and_importAsync(id){
	workSheetLayout.eventHub.emit('import_into_worksheet', id);
	workSheetLayout.eventHub.emit('inspect', id);
}

function inspect_and_import(id) {
	import_into_worksheetAsync(id);
	inspectAsync(id);
}

function showInspectorNextPrevious(isNext){
	inspector.graph.remove('node');
	graphingAPI.add_node(inspectorElementBuffer.nodes[0], inspector.graph);
	if(isNext && currInspectorBufferIndex + inspectorDisplayAmount < inspectorElementBuffer.nodes.length){
		currInspectorBufferIndex += inspectorDisplayAmount;
	}
	else if(!isNext && currInspectorBufferIndex > 1){
		currInspectorBufferIndex -= inspectorDisplayAmount;
	}
	for(let i = currInspectorBufferIndex; i <= currInspectorBufferIndex + inspectorDisplayAmount; i++ ){
		if(i == inspectorElementBuffer.nodes.length){break;}
		graphingAPI.add_node(inspectorElementBuffer.nodes[i], inspector.graph);
	}
	for (let e of inspectorElementBuffer.edges) {
		if(inspector.graph.$id( e.source ).length > 0 && inspector.graph.$id( e.target ).length > 0){
			graphingAPI.add_edge(e, inspector.graph);
		}
	}
	if (inspector.graph.edges.length < limitNodesForDagre) {
		graphingAPI.layout(inspector.graph, 'dagre');
	} else {
		graphingAPI.layout(inspector.graph, 'cose-bilkent');
	}
}

//Inspector Functions end

//NodeSearchsheet Functions

//
// Populate node list.
//
function update_nodelist() {
	neo4jQueries.get_nodes($('#filterNodeType').val(),
							$('#filterName').val(),
							$('#filterHost').val(),
							$('#filterLocalIp').val(),
							$('#filterLocalPort').val(),
							$('#filterRemoteIp').val(), 
							$('#filterRemotePort').val(),
							amountShownInNodeList,
		function(result) {
			let nodelist = $('#nodelist');
			nodelist.empty();

			let current_uuid = null;
			let colour = 0;

			for (let node of result) {
				let meta = graphingAPI.node_metadata(node);

				if (node.uuid != current_uuid) {
					colour += 1;
					current_uuid = node.uuid;
				}

				// nodelist.append(`
				// 	<tr class="${rowColour(colour)}">
				// 		<td><a onclick="inspect_node(${node.id});" style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
				// 		<td>${meta.timestamp}</td>
				// 		<td><a onclick="inspect_node(${node.id});">${meta.label}</a></td>
				// 	</tr>`);

				let table = document.getElementById("nodelist");

				let row = table.insertRow(0);
				row.onclick = (function() {
					inspectAsync(node.id);
				});
				let cell = row.insertCell(0);
				cell.innerHTML = (`
									<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
									<td>${meta.timestamp}</td>
									<td><a>${meta.label}</a></td>
								`);
			}
		}
	);
}

function rowColour(n) {
	switch (n % 6) {
	case 1:
		return 'active';
	case 2:
		return 'info';
	case 3:
		return '';
	case 4:
		return 'warning';
	case 5:
		return 'active';
	case 0:
		return 'success';
	}
}

//NodeSearchsheet Functions end

function inspectAsync(id){
	if(inspector.graph.inspectee != null){
		inspecteeBackStack.push(inspector.graph.inspectee.id());
	}
	inspecteeForwardStack = [];
	workSheetLayout.eventHub.emit('inspect', id);
}

//
// Define what it means to "inspect" a node. 
//
function inspect_node(id) {
	currInspectorBufferIndex = 0;
	if(document.getElementById("overflowWarning") != null){
		document.getElementById("overflowWarning").remove();
	}

	// Display the node's details in the inspector "Details" panel.
	let inspectee;

	inspector.detail.empty();
	inspector.neighbours.empty();

	neo4jQueries.get_detail_id(id, function(result) {
		for (let property in result) {
			if (property == 'timestamp' || property == 'meta_ts') {
				result[property] =
					moment.unix(result[property] / 1000000000).format();
			}
			inspector.detail.append(`
				<tr>
					<th>${property}</th>
					<td>${result[property]}</td>
				</tr>
			`)
		}
		inspectee = result;
		// Display the node's immediate connections in the inspector "Graph" panel.
		get_neighbours(id, function(result) {
			inspector.graph.remove('node');

			inspectorElementBuffer = result;

			graphingAPI.add_node(inspectee, inspector.graph);

			let count = 0;
			let hasSpawnedOverflowWarning = false;
			for (let n of result.nodes) {
				if(count++ < inspectorDisplayAmount){
					graphingAPI.add_node(n, inspector.graph);
				}
				else if(!hasSpawnedOverflowWarning){
					hasSpawnedOverflowWarning = true;
					let overflowWarning = document.createElement("div");
					overflowWarning.id = `overflowWarning`;
					overflowWarning.style.cssText = `color: red;`;
					overflowWarning.innerHTML = `<font size=+1><br>Only showing ${inspectorDisplayAmount + 1} nodes out of ${result.nodes.length} nodes.<br></font>`;
					let lastNodes = document.createElement("button");
					lastNodes.className  = "bodyButton";
					lastNodes.innerHTML = `previous ${inspectorDisplayAmount} nodes`;
					lastNodes.onclick =(function() {
						showInspectorNextPrevious(false);
					});
					overflowWarning.appendChild(lastNodes);
					let nextNodes = document.createElement("button");
					nextNodes.className  = "bodyButton";
					nextNodes.innerHTML = `Next ${inspectorDisplayAmount} nodes`;
					nextNodes.onclick =(function() {
						showInspectorNextPrevious(true);
					});
					overflowWarning.appendChild(nextNodes);
					document.getElementById('inspectorHeader').appendChild(overflowWarning);
				}

				let meta = graphingAPI.node_metadata(n);
				// inspector.neighbours.append(`
				// 	<tr>
				// 		<td><a onclick="import_into_worksheet(${n.id})" style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
				// 		<td><a onclick="import_into_worksheet(${n.id})">${meta.label}</a></td>
				// 	</tr>
				// `);


				let table = document.getElementById("neighbour-detail");

				let row = table.insertRow(0);
				row.onclick = (function() {
					openSubMenu(function(){
						import_into_worksheet(n.id);
					}, true, true);
				});
				let cell = row.insertCell(0);
				cell.innerHTML = (`
								<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
								<td><a>${meta.label}</a></td>
								`);
			}
			for (let e of result.edges) {
				if(inspector.graph.$id( e.source ).length > 0 && inspector.graph.$id( e.target ).length > 0){
					graphingAPI.add_edge(e, inspector.graph);
				}
			}
			let n = inspector.graph.elements().nodes(`[id="${id}"]`);
			if (n.empty()) {
				n = inspector.graph.elements().nodes(`[uuid="${id}"]`);
			}
			inspector.graph.inspectee = n;

			// Only use the (somewhat expensive) dagre algorithm when the number of
			// edges is small enough to be computationally zippy.
			if (inspector.graph.edges.length < limitNodesForDagre) {
				graphingAPI.layout(inspector.graph, 'dagre');
			} else {
				graphingAPI.layout(inspector.graph, 'cose-bilkent');
			}

			inspector.graph.zoom({
				level: 1,
				position: inspector.graph.inspectee.position(),
			});
		});
	});
}

function import_into_worksheetAsync(id){
	workSheetLayout.eventHub.emit('import_into_worksheet', id);
}

//
// How to import a node into the worksheet
//
function import_into_worksheet(id) {
	let graph = worksheets[`${selectedWorksheet}`].graph;

	// Have we already imported this node?
	if (!graph.getElementById(id).empty()) {
		return $.when(null);
	}

	let position = {
		x: graph.width() / 2,
		y: graph.height() / 2,
	};

	neo4jQueries.get_detail_id(id, function(result) {
		let promise = null;

		if (result['parent'] != null && graph.nodes(`[id="${result.parent}"]`).empty()) {
			promise = import_into_worksheet(result.parent);
		} else {
			promise = $.when(null);
		}

		promise.then(function() {
			graphingAPI.add_node(result, graph, position);
		}).then(function() {
			get_neighbours(id, function(result) {
				let elements = graph.elements();
				let node = graph.nodes(`[id="${id}"]`);

				for (let edge of result.edges) {
					let other = null;
					if (edge.source == id) {
						other = elements.nodes(`#${edge.target}`);
					} else if (edge.target == id) {
						other = elements.nodes(`#${edge.source}`);
					}

					if (!other.empty()) {
						graphingAPI.add_edge(edge, graph);
					}
				}
			});
		});
	});
}

//
// Fetch neighbours to a node, based on some user-specified filters.
//
function get_neighbours(id, fn) {
	return neo4jQueries.get_neighbours_id(id,
										fn,	
										inspectFiles,
										inspectSockets,
										inspectPipes,
										inspectProcessMeta
										);
}

function import_batch_into_worksheet(nodes) {
	let graph = worksheets[`${selectedWorksheet}`].graph;
	let ids = [];


	if(nodes.length >= maxImportLength){
		vex.dialog.alert({
			unsafeMessage: `Trying to import more nodes than the maxImportLength:${maxImportLength} allows!`,
			className: 'vex-theme-wireframe'
		});
		return;
	}

	nodes.forEach(function(node){
		if (!graph.$id(node.id).empty()) {
			let index = nodes.indexOf(node);
			nodes.splice(index, 1);
		}
		//else{
			ids = ids.concat(node.id);
		//}
	});
	if(ids.length <= 0){return;}

	let position = {
		x: graph.width() / 2,
		y: graph.height() / 2,
	};
	// if ('parent' in nodes && graph.$id( nodes.parent ).length > 0) {
	// 	import_into_worksheet(nodes.parent);
	// } 
	//console.log(ids);
	graphingAPI.add_node_batch(nodes, graph, position);
	get_neighbours_batch(ids, function(result) {
	
		for (let edge of result.edges) {
			if(graph.$id( edge.source ).length > 0 && graph.$id( edge.target ).length > 0){
				graphingAPI.add_edge(edge, graph);
			}
		}
	});
}

function get_neighbours_batch(ids, fn) {
	return neo4jQueries.get_neighbours_id_batch(ids,
										fn,	
										inspectFiles,
										inspectSockets,
										inspectPipes,
										inspectProcessMeta
										);
}

function import_neighbours_into_worksheetAsync(id){
	workSheetLayout.eventHub.emit('import_neighbours_into_worksheet', id);
}

//
// Add a node and all of its neighbours to the worksheet.
//
function import_neighbours_into_worksheet(id) {
	get_neighbours(id, function(result) {
		import_batch_into_worksheet(result.nodes);
	});
}

//Utility Functions

function htmlBody() {
	let element = document.createElement('div');
	element.classList.add('box');
	
								// <input id="loadWorksheet" name="file" type="file" style="display: none">
								// <button class="headerButton" onclick="document.getElementById('loadWorksheet').click();">Load New Worksheet</button>
	element.innerHTML = `<div class="row header fillHeader">
							<font size="+3">&nbsp;CADETS/OPUS&nbsp;</font>
							<button type="button" class="headerButton" id="newWorksheet">Open New Worksheet</button>
							<button type="button" class="headerButton" id="toggleNodeSearchsheet">Close NodeSearchsheet</button>
						</div>
						<div class="row content notScrollable" style="padding: 0.5%;" id="worksheetPage"></div>`;

	return element;
}

function refreshGraph(graph){
	graph.resize();
}

function findMouseCoords(mouseEvent)
{
	let obj = document.getElementById("worksheetPage");
	let obj_left = 0;
	let obj_top = 0;
	let xpos;
	let ypos;
	while (obj.offsetParent)
	{
		obj_left += obj.offsetLeft;
		obj_top += obj.offsetTop;
		obj = obj.offsetParent;
	}
	if (mouseEvent)
	{
		//FireFox
		xpos = mouseEvent.pageX;
		ypos = mouseEvent.pageY;
	}
	else
	{
		//IE
		xpos = window.event.x + document.body.scrollLeft - 2;
		ypos = window.event.y + document.body.scrollTop - 2;
	}
	xpos -= obj_left;
	ypos -= obj_top;
	currMouseX = xpos;
	currMouseY = ypos;
}

function removeEmptyParents(parents){
	parents.forEach(function(parent){
		if(parent.isChildless()){
			parent.remove();
		}
	})
}

function setRefreshGraphOnElementShow(watchElement, graph){
	let targetNode = document.getElementById(watchElement).parentElement.parentElement;
	let observer = new MutationObserver(function(){
		if(targetNode.style.display !='none' && graph != null){
			refreshGraph(graph);
		}
	});
	observer.observe(targetNode,  { attributes: true, childList: true });
}

function openSubMenu(fn, isNewWorksheetOption = true, leftClickSpawn = false){
	if(document.getElementById("myDropdown") != null){
		document.getElementById("myDropdown").remove();
	}
	let cxtSubMenu = document.createElement('div');
	cxtSubMenu.style.cssText = `left:${currMouseX}px;top:${currMouseY}px;`;
	cxtSubMenu.className = 'dropdown-content';
	cxtSubMenu.id = 'myDropdown';

	for(let i in worksheets){
		let SubMenuOption = document.createElement('a');
		SubMenuOption.text = `Worksheet_${i}`;
		SubMenuOption.onclick =(function() {
			selectedWorksheet = i;
			fn();
		});
		cxtSubMenu.appendChild(SubMenuOption);
	}
	if(isNewWorksheetOption){
		let SubMenuOption = document.createElement('a');
		SubMenuOption.text = `New Worksheet`;
		SubMenuOption.onclick =(function() {
			selectedWorksheet = getWorksheetCount();
			addNewWorksheet()
			fn();
		});
		cxtSubMenu.appendChild(SubMenuOption);
	}
	document.body.appendChild(cxtSubMenu);
	window.onclick = function(event) {
		if(!leftClickSpawn){//this is here so SubMenu is usable with a left click
			document.getElementById(`myDropdown`).remove();
			window.onclick = null;
		}
		leftClickSpawn = false;
	}
}

//an attempt to sync filters between popouts 
function updateInspectTargets(files, scokets, pipes, meta){
	if(document.getElementById(`worksheetGraph${getWorksheetCount()}`) != null)
	{
		$('#inspectFiles').value = files;
		$('#inspectSockets').value = scokets;
		$('#inspectPipes').value = pipes;
		$('#inspectProcessMeta').value = meta;
	}
	inspectFiles = files;
	inspectSockets = scokets;
	inspectPipes = pipes;
	inspectProcessMeta = meta;
}

function testIfNumber(val){
	return /^\d+$/.test(val);
}

//Utility Functions end

//Functions end