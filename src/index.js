import _ from 'lodash';
import $ from './../node_modules/jquery/dist/jquery.js';
import vex from './../node_modules/vex-js/dist/js/vex.combined.min.js';
import cytoscape from './../node_modules/cytoscape/dist/cytoscape.min.js';
import cxtmenu from './../node_modules/cytoscape-cxtmenu/cytoscape-cxtmenu.js';
import moment from './../node_modules/moment/moment.js';
import GoldenLayout from './../node_modules/golden-layout/dist/goldenlayout.min.js';
import events from './../node_modules/events/events.js';

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
var eventEmitter = new events.EventEmitter();

cytoscape.use( cxtmenu );
cytoscape.use( dagre );
cytoscape.use( cose_bilkent );

//Build Html document
const GUI_VERSION = 'v0.5.0-dev';
let PVM_VERSION = '';

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
var worksheets = [];

var selectedWorksheet = 0;

var inspecteeBackStack = [];
var inspecteeForwardStack = [];

var highlightedIDs = [];

var inspectFiles = false;
var inspectSockets = false;
var inspectPipes = false;
var inspectProcessMeta = false;

var nodeSearchsheetContainer;
var worksheetContainer = [];
var inspectorContainer;
var detailsContainer;
var neighboursContainer;


let UILock = false;//for overFlow ui lock
var overFlowVars = {'nodeList':{'DisplayAmount':100, 'func':showNodeListNextPrevious, 'appendTo':'formBox', 'cntFunc': getNodeCount,
					'IDStart':-1, 'IDEnd':-1, 'IDNextStart':-2, 'LastLowestShownIDs':[], 'OverflowWarning':false,
					'totalCount': '', 'startDisplayNum': 1, 'currDisplayAmount': 0},
					'inspector':{'DisplayAmount':25, 'func':showInspectorNextPrevious, 'appendTo':'inspectorHeader', 'cntFunc':null,
					'IDStart':-1, 'IDEnd':-1, 'IDNextStart':-2, 'LastLowestShownIDs':[], 'OverflowWarning':false,
					'totalCount': '', 'startDisplayNum': 1, 'currDisplayAmount': 0, 'inspectee':-1}};


var limitNodesForDagre = 100;//The max number of nodes the inspector will use the Dagre layout
var maxImportLength = 500;//The max number of nodes that can be imported into a worksheet in one action

var workSheetLayout = goldenLayoutHTML.intiGoldenLayoutHTML();

var worksheetChildCxtMenu = ({
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
			select: function(ele){
				spawnVexList(ele, 'Files read by', 'identity', ['properties','name'], neo4jQueries.file_read_query);
			}
		},
		{
			content: 'Commands',
			select: function(ele){
				spawnVexList(ele, 'Commands run by node', 'id', ['cmdline'], neo4jQueries.cmd_query);
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
					removeNode(ele);
				}, false);
			}
		},
	]
});

var worksheetParentCxtMenu = ({
	menuRadius: 70,
	separatorWidth: 0,
	selector: 'node:parent',
	commands: [
		{
			content: 'Remove',
			select: function(ele){
				openSubMenu(function(){
					removeNode(ele);
				}, false);
			}
		},
	]
});

var inspectorChildCxtMenu = ({
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

var worksheetCxtMenus = [worksheetChildCxtMenu, worksheetParentCxtMenu];
var inspectorCxtMenus = [inspectorChildCxtMenu];

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
		neo4jQueries.neo4jLogin(eventEmitter);
		$('input[id *= "filter"],select[id *= "filter"]').on('change', update_nodelist);
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

	document.getElementById(`dropdownOptions`).onclick = function () {
		let menu = document.getElementById(`optionMenu`);
		if (menu.style.display === "none") {
			menu.style.display = "block";
		} else {
			menu.style.display = "none";
		}
		workSheetLayout.updateSize();
	};

	// document.getElementById(`loadWorksheet`).onclick = function () {
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

eventEmitter.on('pvm_version_set', function(pvm_version){
	PVM_VERSION = pvm_version;
	graphingAPI.setPVMVersion(PVM_VERSION);
})

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

	worksheets[`${index}`] = { graph: worksheetGraph, id: index};

	worksheetContainer[index].on('resize', function(){
		refreshGraph(worksheets[`${index}`].graph);
	})

	setWorksheetCxtMenu(index);

	//setRefreshGraphOnElementShow(`worksheet${index}`, worksheetGraph);

	document.getElementById(`loadGraph${index}`).onchange = function () {
		if(this.files[0] == ''){return;}
		graphingAPI.load(this.files[0], worksheets[`${index}`].graph, highlightedIDs, function(newGraph, newHighLight){
			newHighLight.forEach(function(id){
				toggle_node_importance(id, index);
			});
			worksheets[`${index}`].graph = newGraph;
			setWorksheetCxtMenu(index);
			document.getElementById(`loadGraph${index}`).value = '';
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

function toggle_node_importance(id, excludeWorksheet = -1) {
	let index = highlightedIDs.indexOf(id);
	if(index >= 0){
		highlightedIDs.splice(index, 1);
	}
	else{
		highlightedIDs = highlightedIDs.concat(id);
	}
	worksheets.forEach( function(worksheet){
		if(worksheet.id == excludeWorksheet){ return; }
		let ele = worksheet.graph.$id( id );
		if(ele.length > 0){
			if (ele.hasClass('important')) {
				ele.removeClass('important');
			} else {
				ele.addClass('important');
			}
		}
	});
}

// //
// // Import successor nodes into selected worksheet 
// //
// function successors(id) {
// 	let graph = worksheets[`${selectedWorksheet}`].graph;

// 	get_successors(id, function(result) {

// 		let position = {
// 			x: graph.width() / 2,
// 			y: graph.height() / 2,
// 		};

// 		graphingAPI.add_node_batch(result.nodes, graph, position, highlightedIDs);
// 		graphingAPI.add_edge_batch(result.edges, graph);
// 	});
// }

// //
// // Fetch successors to a node, based on some user-specified filters.
// //
// function get_successors(id, fn) {
// 	return neo4jQueries.successors_query(id,
// 										100,
// 										inspectFiles,
// 										inspectSockets,
// 										inspectPipes,
// 										inspectProcessMeta,
// 										fn);
// }

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

	setRefreshGraphOnElementShow('inspectorGraph', inspector.graph);

	setInspectorCxtMenu();

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

	inspectorContainer.on('resize', function(){
		refreshGraph(inspector.graph);
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

//Inspector Functions end

//NodeSearchsheet Functions

//
// Populate node list.
//
function update_nodelist() {
	removeOverFlow(`nodeList`);
	showNodeListNextPrevious();
}

function showNodeListNextPrevious(){
	neo4jQueries.get_nodes($('#filterNodeType').val(),
							$('#filterName').val(),
							$('#filterHost').val(),
							$('#filterLocalIp').val(),
							$('#filterLocalPort').val(),
							$('#filterRemoteIp').val(), 
							$('#filterRemotePort').val(),
							overFlowVars[`nodeList`][`DisplayAmount`] + 1,
							overFlowVars['nodeList'][`IDStart`],
							false,
		function(result) {
			let nodelist = $('#nodelist');
			nodelist.empty();

			updateOverFlow('nodeList', result);

			for (let node of result) {
				let meta = graphingAPI.node_metadata(node);

				let row = document.getElementById("nodelist").insertRow(0);
				row.onclick = (function() {
					inspectAsync(node.id);
				});
				let cell = row.insertCell(0);
				cell.innerHTML = (`<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
									<td>${meta.timestamp}</td>
									<td><a>${meta.label}</a></td>
								`);
			}
		}
	);
}

function getNodeCount(fn){
	neo4jQueries.get_nodes($('#filterNodeType').val(),
							$('#filterName').val(),
							$('#filterHost').val(),
							$('#filterLocalIp').val(),
							$('#filterLocalPort').val(),
							$('#filterRemoteIp').val(), 
							$('#filterRemotePort').val(),
							0,0,
							true,
		function(result) {
			fn(result);
		}
	);
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
// Displays the selected node and neighbours in the Inspector window
//
function inspect_node(id) {
	removeOverFlow('inspector');
	overFlowVars['inspector'][`inspectee`] = id;
	showInspectorNextPrevious();
}

function showInspectorNextPrevious(){
	let id = overFlowVars['inspector'][`inspectee`];

	inspector.detail.empty();
	inspector.neighbours.empty();

	// Display the node's immediate connections in the inspector "Graph" panel.
	get_neighbours(id, true,
		overFlowVars[`inspector`][`DisplayAmount`] + 1, 
		overFlowVars['inspector'][`IDStart`], 
		function(result) {
			let inspectee = result.focusNode;
			for (let prop in inspectee) {
				if (prop == 'timestamp' || prop == 'meta_ts') {
					inspectee[prop] =
						moment.unix(inspectee[prop] / 1000000000).format();
				}
				inspector.detail.append(`
					<tr>
						<th>${prop}</th>
						<td>${inspectee[prop]}</td>
					</tr>
				`)
			}

			inspector.graph.remove('node');

			graphingAPI.add_node(inspectee, inspector.graph);

			updateOverFlow('inspector', result.nodes);

			graphingAPI.add_node_batch(result.nodes, inspector.graph, null, [], function(node){
				let meta = graphingAPI.node_metadata(node);

				let row = document.getElementById("neighbour-detail").insertRow(0);
				row.onclick = (function() {
					openSubMenu(function(){
						import_into_worksheet(node.id);
					}, true, true);
				});
				let cell = row.insertCell(0);
				cell.innerHTML = (`
								<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
								<td><a>${meta.label}</a></td>
								`);
			});

			graphingAPI.add_edge_batch(result.edges, inspector.graph);
			let n = inspector.graph.$id(id);
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
		}
	);
}

function getInspectorCount(fn){
	get_neighbours(id, false,
		0, 0, 
		function(result) {

		},
		true
	);
}

function import_into_worksheetAsync(id){
	workSheetLayout.eventHub.emit('import_into_worksheet', id);
}

//
// How to import a node into the worksheet
//
function import_into_worksheet(id) {
	neo4jQueries.get_detail_id(id, function(result) {
		import_batch_into_worksheet(result);
	});
}

//
// Fetch neighbours to a node, based on some user-specified filters.
//
function get_neighbours(id, isOverFlow=false, displayAmount = -1, startID = 0, fn, countOnly = false) {
	return neo4jQueries.get_neighbours_id(id,
										fn,	
										inspectFiles,
										inspectSockets,
										inspectPipes,
										inspectProcessMeta,
										isOverFlow,
										displayAmount,
										startID,
										countOnly);
}

function import_batch_into_worksheet(nodes) {
	let graph = worksheets[`${selectedWorksheet}`].graph;
	let ids = [];

	for(let node of nodes){
		if (!graph.$id(node.id).empty()) {
			nodes.splice(nodes.indexOf(node), 1);
		}
		else{
			ids = ids.concat(node.id);

			if(ids.length >= maxImportLength){
				vex.dialog.alert({
					unsafeMessage: `Trying to import more nodes than the maxImportLength:${maxImportLength} allows!`,
					className: 'vex-theme-wireframe'
				});
				return;
			}
		}
	}
	if(ids.length <= 0){return;}

	let position = {
		x: graph.width() / 2,
		y: graph.height() / 2,
	};
	graphingAPI.add_node_batch(nodes, graph, position, highlightedIDs);
	neo4jQueries.get_all_edges_batch(ids, function(edges){
		graphingAPI.add_edge_batch(edges, graph);
	});
}

function import_neighbours_into_worksheetAsync(id){
	workSheetLayout.eventHub.emit('import_neighbours_into_worksheet', id);
}

//
// Add a node and all of its neighbours to the worksheet.
//
function import_neighbours_into_worksheet(id) {
	get_neighbours(id, false, -1, 0, function(result) {
		import_batch_into_worksheet(result.nodes.concat(result.focusNode));
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
							<button type="button" class="headerButton" id="dropdownOptions">Options</button>
							<div class="optionMenu" id="optionMenu">
								<h2>Options</h2>
								<font>GUI_Version: ${GUI_VERSION}</font>
							</div>
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
	currMouseX = xpos;//setting global var
	currMouseY = ypos;//setting global var
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
	if_DOM_IDExsitsRemove("myDropdown");
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

function if_DOM_IDExsitsRemove(id){
	if(document.getElementById(id) != null){
		document.getElementById(id).remove();
	}
}

function updateOverFlow(name, results){
	if(results.length <= 0){return;}
	overFlowVars[name][`IDNextStart`] = results[results.length-1].id;
	let length = results.length;
	if(results.length > overFlowVars[name][`DisplayAmount`]){
		results.splice(results.length-1, 1);
	}
	overFlowVars[name][`IDEnd`] = results[results.length-1].id;
	overFlowVars[name]['currDisplayAmount'] = results.length;
	if(length > overFlowVars[name][`DisplayAmount`] && !overFlowVars[name][`OverflowWarning`]){
		spawnOverFlow(name);
	}
}

function removeOverFlow(name){
	if_DOM_IDExsitsRemove(`${name}OverflowWarning`);
	overFlowVars[name][`OverflowWarning`] = false;
	overFlowVars[name][`IDStart`] = -1;
	overFlowVars[name][`LastLowestShownIDs`] = [];
	overFlowVars[name][`startDisplayNum`] = 1;
	overFlowVars[name][`totalCount`] = '';
}

function updateOverFlowText(name){
	if(overFlowVars[name][`cntFunc`] != null){
		overFlowVars[name][`cntFunc`](function(cnt){
			overFlowVars[name][`totalCount`] = cnt;
			let node = document.getElementById(`${name}NodesShowing`);
			let displayNum = overFlowVars[name][`startDisplayNum`];
			let string =`Showing ${displayNum} - ${displayNum + overFlowVars[name]['currDisplayAmount'] -1} of ${overFlowVars[name][`totalCount`]}`;
			node.innerHTML = string;
		});
	}
	else{
		let node = document.getElementById(`${name}NodesShowing`);
		let displayNum = overFlowVars[name][`startDisplayNum`];
		let string =`Showing ${displayNum} - ${displayNum + overFlowVars[name]['currDisplayAmount'] -1} of ${overFlowVars[name][`totalCount`]}`;
		node.innerHTML = string;
	}
}

function spawnOverFlow(name){
	overFlowVars[name][`OverflowWarning`] = true;
	let overflowWarning = document.createElement("div");
	overflowWarning.id = `${name}OverflowWarning`;

	let warningText = document.createElement("div");
	warningText.id  = `${name}NodesShowing`;
	warningText.innerHTML = '';
	overflowWarning.appendChild(warningText);

	let lastNodes = document.createElement("button");
	lastNodes.className = "headerButton";
	lastNodes.innerHTML = `previous ${overFlowVars[name][`DisplayAmount`]} nodes`;
	lastNodes.onclick = function(){
		getPreviousNodes(name);
	};
	overflowWarning.appendChild(lastNodes);

	let nextNodes = document.createElement("button");
	nextNodes.className  = "headerButton";
	nextNodes.innerHTML = `Next ${overFlowVars[name][`DisplayAmount`]} nodes`;
	nextNodes.onclick = function(){
		getNextNodes(name);
	};
	overflowWarning.appendChild(nextNodes);

	document.getElementById(overFlowVars[name][`appendTo`]).appendChild(overflowWarning);
	updateOverFlowText(name);
}

function getPreviousNodes(name){
	if(overFlowVars[name][`LastLowestShownIDs`].length > 0 && !UILock){
		UILock = true;
		overFlowVars[name][`IDStart`] = overFlowVars[name][`LastLowestShownIDs`].pop();
		overFlowVars[name][`func`]();
		overFlowVars[name][`startDisplayNum`] -= overFlowVars[name][`DisplayAmount`];
		updateOverFlowText(name);
		UILock = false;
	}
}

//var test = 0;
function getNextNodes(name){
	if(//overFlowVars[name][`IDStart`] != overFlowVars[name][`IDNextStart`] && 
		overFlowVars[name][`IDNextStart`] != overFlowVars[name][`IDEnd`] && 
		!UILock){
		UILock = true;
		overFlowVars[name][`LastLowestShownIDs`] = overFlowVars[name][`LastLowestShownIDs`].concat(overFlowVars[name][`IDStart`]);
		overFlowVars[name][`IDStart`] = overFlowVars[name][`IDNextStart`];
		overFlowVars[name][`func`]();
		overFlowVars[name][`startDisplayNum`] += overFlowVars[name][`DisplayAmount`];
		updateOverFlowText(name);
		UILock = false;
	}
}

function spawnVexList(ele, message, resultID, resultName, func){
	let id = ele.data('id');
	func(id, function(results) {
		let files = document.createElement("ul");
		let header = document.createElement("h2");
			header.innerHTML = `<font>${message} ${id}:</font>`;
			files.appendChild(header);
			results.forEach(function(result) {
			let file = document.createElement("li");
			let name = result;
			resultName.forEach(function(prop){
				name = name[prop];
			})
			file.innerHTML = `<a>${name}</a>`;
			file.onclick =(function() {
				openSubMenu(function(){
					inspect_and_importAsync(result[resultID]);
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

function removeNode(ele){
	let node = worksheets[`${selectedWorksheet}`].graph.$id(ele.data("id"));
	node.remove();
	removeEmptyParents(node.parents());
}

function setInspectorCxtMenu(){
	setGraphCxtMenu(inspector.graph, inspectorCxtMenus);
}

function setWorksheetCxtMenu(index){
	setGraphCxtMenu(worksheets[index].graph, worksheetCxtMenus);
}

function setGraphCxtMenu(graph, cxtMenus){
	cxtMenus.forEach(function(menu){
		graph.cxtmenu(menu);
	});
}

//Utility Functions end

//Functions end