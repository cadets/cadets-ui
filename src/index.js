import _ from 'lodash';
import $ from './../node_modules/jquery/dist/jquery.js';
import vex from './../node_modules/vex-js/dist/js/vex.combined.min.js';
import cytoscape from './../node_modules/cytoscape/dist/cytoscape.min.js';
import cxtmenu from './../node_modules/cytoscape-cxtmenu/cytoscape-cxtmenu.js';
import moment from './../node_modules/moment/moment.js';
import GoldenLayout from './../node_modules/golden-layout/dist/goldenlayout.min.js';

//import './../node_modules/hashids/dist/hashids.min.js';
import dagre from './../node_modules/cytoscape-dagre/cytoscape-dagre.js';

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

//Global variables

var currMouseX = 0;
var currMouseY = 0;

var worksheetGraph;
var inspectorGraph;
var inspector;
var worksheets = {};
var selectedWorksheet = 0;
var lastInspectedId = null;
var inspectFiles = false;
var inspectSockets = false;
var inspectPipes = false;
var inspectProcessMeta = false;
//var mchs;

var worksheetContainer;
var inspectorContainer;


var worksheetCxtMenu = ( 
{
	menuRadius: 140,
	separatorWidth: 5,
	selector: 'node',
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
		{
			content: 'Import successors',
			select: function(ele){
				openSubMenu(function(){
					successors(ele.data('id'));
				});
			}
		},
		{
			content: 'Highlight',
			select: function(ele){
				toggle_node_importance(ele.data("id"));
			}
		},
		{
			content: 'Files read',
			select: function(ele){
				var id = ele.data('id');
				neo4jQueries.file_read_query(id, function(result){
					let str = '';
					 result.forEach(function(name) {
						str += `<li>${name}</li>`;  // XXX: requires trusted UI server!
					 });
					 vex.dialog.alert({
						unsafeMessage: `<h2>Files read:</h2><ul>${str}</ul>`,
						className: 'vex-theme-wireframe'
					 });
				});
			}
		},
		{
			content: 'Commands',
			select: function(ele){
				var id = ele.data('id');
				neo4jQueries.cmd_query(id, function(result) {
					let message = `<h2>Commands run by node ${id}:</h2>`;
					if (result.length == 0) {
						message += '<p>none</p>';
					} else {
						message += '<ul>';
						for (let command of result) {
							message += `<li><a onclick="command_clicked(${command.dbid})">${command.cmdline}</a></li>`;
						}
						message += '</ul>';
					}
					vex.dialog.alert({ unsafeMessage: message, 
										className: 'vex-theme-wireframe'});
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
				ele.remove();
			}
		},
	]
});

var workSheetLayout = goldenLayoutHTML.intiGoldenLayoutHTML();

//Global variables end

//Run

workSheetLayout.registerComponent( 'NodeSearchsheet', function( container, state ){
	container._config.isClosable = false;
	container.getElement().html(state.text);
});
workSheetLayout.registerComponent( `Worksheet`, function( container, state ){
	container.getElement().html(state.text);
	container.setTitle(`Worksheet_0`);
	worksheetContainer = container;
});
workSheetLayout.registerComponent( 'Inspector', function( container, state ){
	container._config.isClosable = false;
	container.getElement().html(state.text);
	inspectorContainer = container;
});

workSheetLayout.init();

//Run end

//Events

workSheetLayout.on('initialised', function(){
	if(document.getElementById("analysisWorksheet") != null){
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


	// document.getElementById(`loadWorksheet`).onclick = function () {
	// 	console.log(this);
	// 	goldenLayoutHTML.addWorksheet(workSheetLayout, function(){
	// 		//graphingAPI.load(this.files[0], worksheets[`${getWorksheetCount() -1}`].graph, worksheetCxtMenu);
	// 	});
	// };

	document.getElementById(`newWorksheet`).onclick = function () {
		addNewWorksheet();
	};
});

//Currently assumes that only the inspector can be windowed 
workSheetLayout.on('windowOpened', function( id ){
	workSheetLayout.eventHub.emit('inspectorWindowOpened', lastInspectedId, neo4jQueries);
});

var once = false;

workSheetLayout.eventHub.on('inspectorWindowOpened', function( id, currNeo4jQueries ){
	if(document.getElementById("analysisWorksheet") != null && !once){
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

workSheetLayout.eventHub.on('updateInspectTargets', function(files, sockets, pipes, meta){
	updateInspectTargets(files, sockets, pipes, meta);
});

window.onresize = function(){
	workSheetLayout.updateSize();
}

document.getElementById("worksheetPage").onmousemove = findMouseCoords;

workSheetLayout.on("tabCreated", function(tab){
	if(tab.contentItem.componentName == "Worksheet"){
		tab.setTitle(`Worksheet_${getWorksheetCount()}`);
		tab.contentItem.worksheetID = getWorksheetCount();
	}
});

workSheetLayout.on(`itemDestroyed`, function(item){
	if(item.componentName == "Worksheet"){
		console.log(item);
		delete worksheets[`${item.worksheetID}`];
	}
});

workSheetLayout.on(`WorksheetContainerCreated`, function(fn){
	createWorksheet();
	fn();
});

//Events end

//Functions

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
		//IE/chrome
		xpos = window.event.x + document.body.scrollLeft - 2;
		ypos = window.event.y + document.body.scrollTop - 2;
	}
	xpos -= obj_left;
	ypos -= obj_top;
	currMouseX = xpos;
	currMouseY = ypos;
}

function addNewWorksheet(){
	goldenLayoutHTML.addWorksheet(workSheetLayout, function(){
		let temp = workSheetLayout.root.contentItems[ 0 ].contentItems;
		temp[ temp.length-1 ].on('resize', function(){
			refreshGraph(worksheets[`${getWorksheetCount() -1}`].graph);
		});
	});
}

function openSubMenu(fn, e, isNewWorksheetOption = true ){

	let cxtSubMenu = document.createElement('div');
	cxtSubMenu.style.cssText = `left:${currMouseX}px;top:${currMouseY}px;`;
	cxtSubMenu.className = 'dropdown-content';
	cxtSubMenu.id = 'myDropdown';

	for(let i in worksheets){
		let SubMenuOption = document.createElement('a');
		SubMenuOption.text = `Worksheet_${i}`;
		SubMenuOption.onclick =(function() {
			console.log(i);
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
		document.getElementById(`myDropdown`).remove();
		window.onclick = null;
	}
}

function getWorksheetCount(){
	return goldenLayoutHTML.getWorksheetCount();
}

function htmlBody() {
	let element = document.createElement('div');
	element.classList.add('box');
//<input id="loadWorksheet" name="file" type="file" style="display: none">
//<button onclick="document.getElementById('loadWorksheet').click();" class="headerButton">Load Worksheet</button>
	element.innerHTML = `<div class="row header fillHeader">
							<font size="+3">&nbsp;CADETS/OPUS&nbsp;</font>
								<button type="button" class="headerButton" id="newWorksheet">Open New Worksheet</button>
						</div>
						<div class="row content" style="padding: 1%;" id="worksheetPage"></div>`;

	return element;
}

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

function createWorksheet(){
	let index = getWorksheetCount();
	worksheetGraph = graphingAPI.create(`worksheetGraph${index}`);


	worksheets[`${index}`] = { graph: worksheetGraph};

	worksheetContainer.on('resize', function(){
		refreshGraph(worksheets[`${index}`].graph);
	})

	worksheetGraph.cxtmenu(worksheetCxtMenu);

	$('input[id *= "filter"],select[id *= "filter"]').on('change', update_nodelist);

	document.getElementById(`loadGraph${index}`).onchange = function () {
		graphingAPI.load(this.files[0], worksheets[`${index}`].graph, worksheetCxtMenu);
	};

	document.getElementById(`saveGraph${index}`).onclick = function () {
		graphingAPI.save(worksheets[`${index}`].graph, document.getElementById(`saveFilename${index}`).value);
	};

	document.getElementById(`reDagre${index}`).onclick = function () {
		//worksheets[`${index}`].graph.resize();
		//refreshGraph(worksheets[`${index}`].graph);
		//workSheetLayout.root.contentItems[ 0 ].addChild( goldenLayoutHTML.newItemConfig );
		//graphingAPI.layout( worksheets[`${index}`].graph, 'cose'); //TODO: get cDagre
	};

	document.getElementById(`reCose-Bilkent${index}`).onclick = function () { 
		graphingAPI.layout( worksheets[`${index}`].graph, 'cose'); //TODO: get cose-bilkent
	};
	goldenLayoutHTML.incrementWorksheetCount();
}


function createInspector(){
	inspectorGraph = graphingAPI.create('inspectorGraph');

	inspector = {
		detail: $('#inspector-detail'),
		neighbours: $('#neighbour-detail'),
		graph: inspectorGraph,
	};
	inspector.graph.inspectee = null;

	inspectorContainer.on('resize', function(){
		refreshGraph(inspector.graph);
	})

	inspectorGraph.cxtmenu({
		selector: 'node',
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
		if (lastInspectedId != null) {
			inspectAsync(lastInspectedId);
		}
	});
}

function remove_neighbours_from_worksheet(id) {
	console.log(`${selectedWorksheet}`);
	console.log(worksheets);
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
	return !ele.hasClass('important');
	}).remove();
}

function toggle_node_importance(id) {
	let nodes = [];
	let i;
	for(i in worksheets){
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

function command_clicked(dbid) {
	inspect_and_import(dbid);

	let vexes = vex.getAll();
	for (let i in vexes) {
		vexes[i].close();
	}
}

//
// How to add an edge to the worksheet
//
function add_edge(data, graph) {
	// Have we already imported this edge?
	if (!graph.edges(`#${data.id}`).empty()) {
		return;
	}

	// If the target is explicitly marked as something we read from
	// (e.g., the by-convention read-from pipe), reverse the edge's direction.
	let source = graph.nodes(`[id="${data.source}"]`);
	let target = graph.nodes(`[id="${data.target}"]`);

	if (source.data() && source.data().type == 'process'
		&& target.data() && target.data().end == 'R') {
		let tmp = data.source;
		data.source = data.target;
		data.target = tmp;
	}

	graph.add({
		classes: data.type,
		data: data,
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

//
// Fetch successors to a node, based on some user-specified filters.
//
function get_successors(id, fn, err = console.log) {
	return neo4jQueries.successors_query(id,
										100,
										inspectFiles,
										inspectSockets,
										inspectPipes,
										inspectProcessMeta,
										fn);
}

function import_into_worksheetAsync(id){
	workSheetLayout.eventHub.emit('import_into_worksheet', id);
}

//
// How to import a node into the worksheet
//
function import_into_worksheet(id, err = console.log) {
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

		if ('parent' in result && graph.nodes(`[id="${result.parent}"]`).empty()) {
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
						add_edge(edge, graph);
					}
				}
			});
		});
	});
}

function inspect_and_importAsync(id){
	workSheetLayout.eventHub.emit('import_into_worksheet', id);
	workSheetLayout.eventHub.emit('inspect', id);
}

function inspect_and_import(id) {
	import_into_worksheetAsync(id);
	inspectAsync(id);
}

function import_neighbours_into_worksheetAsync(id){
	workSheetLayout.eventHub.emit('import_neighbours_into_worksheet', id);
}

//
// Add a node and all of its neighbours to the worksheet.
//
function import_neighbours_into_worksheet(id) {
	// Get all of the node's neighbours:
	get_neighbours(id, function(result) {
		let promise = $.when(null);

		for (let n of result.nodes) {
			promise.then(function() { import_into_worksheet(n.id); });
		}
	});
}

function inspectAsync(id){
	lastInspectedId = id;
	workSheetLayout.eventHub.emit('inspect', id);
}

//
// Define what it means to "inspect" a node.
//
function inspect_node(id, err = console.log) {
	// Display the node's details in the inspector "Details" panel.
	var inspectee;

	inspector.detail.empty();
	inspector.neighbours.empty();

	neo4jQueries.get_detail_id(id, function(result) {
		for (let property in result) {
			if (property == 'timestamp' || property == 'meta_ts') {
				result[property] =
					moment.unix(result[property] / 1000000000).format('HH:mm[h] D MMM');
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

			graphingAPI.add_node(inspectee, inspector.graph);

			for (let n of result.nodes) {
				graphingAPI.add_node(n, inspector.graph);

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
					import_into_worksheet(n.id);
				});
				let cell = row.insertCell(0);
				cell.innerHTML = (`
								<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
								<td><a>${meta.label}</a></td>
								`);
			}

			for (let e of result.edges) {
				add_edge(e, inspector.graph);
			}

			let n = inspector.graph.elements().nodes(`[id="${id}"]`);
			if (n.empty()) {
				n = inspector.graph.elements().nodes(`[uuid="${id}"]`);
			}
			inspector.graph.inspectee = n;


			// Only use the (somewhat expensive) dagre algorithm when the number of
			// edges is small enough to be computationally zippy.
			if (result.edges.length < 100) {
				graphingAPI.layout(inspector.graph, 'dagre');
			} else {
				graphingAPI.layout(inspector.graph, 'cose');
			}

			inspector.graph.zoom({
				level: 1,
				position: inspector.graph.inspectee.position(),
			});
		});
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
			add_edge(e, graph);
		}
	});
}

//
// Populate node list.
//
function update_nodelist(err = console.log) {
	neo4jQueries.get_nodes($('#filterNodeType').val(),
				$('#filterName').val(),
				$('#filterHost').val(),
				$('#filterLocalIp').val(),
				$('#filterLocalPort').val(),
				$('#filterRemoteIp').val(), 
				$('#filterRemotePort').val(),
				'100',
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
			});
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

function refreshGraph(graph){
	graph.resize();
}

//Functions end