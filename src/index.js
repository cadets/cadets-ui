import _ from 'lodash';
import $ from './../node_modules/jquery/dist/jquery.js';
import vex from './../node_modules/vex-js/dist/js/vex.combined.min.js';
import cytoscape from './../node_modules/cytoscape/dist/cytoscape.min.js';
import cxtmenu from './../node_modules/cytoscape-cxtmenu/cytoscape-cxtmenu.js';
import moment from './../node_modules/moment/moment.js';
import GoldenLayout from './../node_modules/golden-layout/dist/goldenlayout.min.js';
import events from './../node_modules/events/events.js';

import dagre from './../node_modules/cytoscape-dagre/cytoscape-dagre.js';
import cose_bilkent from './../node_modules/cytoscape-cose-bilkent/cytoscape-cose-bilkent.js';

import './../node_modules/vex-js/dist/css/vex.css';
import './../node_modules/vex-js/dist/css/vex-theme-wireframe.css';
import './../node_modules/golden-layout/src/css/goldenlayout-base.css';
import './../node_modules/golden-layout/src/css/goldenlayout-dark-theme.css';
import './../node_modules/golden-layout/src/css/goldenlayout-light-theme.css';
import './css/darkStyle.css';
import './css/lightStyle.css';


var utilFunc = require('./utilFunc.js');
var graphingAPI = require('./graphing.js');
var neo4jQueries = require('./neo4jQueries.js');
var goldenLayoutHTML = require('./goldenLayoutHTML.js');
var eventEmitter = new events.EventEmitter();

//Find less hacky way to assign these vars 
var darkGoldTheme = document.styleSheets[document.styleSheets.length-4];
var lightGoldTheme = document.styleSheets[document.styleSheets.length-3];
var darkTheme = document.styleSheets[document.styleSheets.length-2];
var lightTheme = document.styleSheets[document.styleSheets.length-1];
lightGoldTheme.disabled= true;
lightTheme.disabled= true;
graphingAPI.swapStyle(true);

cytoscape.use( cxtmenu );
cytoscape.use( dagre );
cytoscape.use( cose_bilkent );

//Build Html document
const GUI_VERSION = 'v0.7.0-dev';
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
	module.hot.accept('./utilFunc.js', function() {
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
var reportGenGraph;

var selectedWorksheet = 0;
var rowReportSelected = null;

var inspecteeBackStack = [];
var inspecteeForwardStack = [];

var highlightedIDs = [];

var annotationHandlers = {};
var pathHandlers = {};

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
					'inspector':{'DisplayAmount':25, 'func':showInspectorNextPrevious, 'appendTo':'inspectorHeader', 'cntFunc':getInspectorCount,
					'IDStart':-1, 'IDEnd':-1, 'IDNextStart':-2, 'LastLowestShownIDs':[], 'OverflowWarning':false,
					'totalCount': '', 'startDisplayNum': 1, 'currDisplayAmount': 0, 'inspectee':-1}};

var limitNodesForDagre = 100;//The max number of nodes the inspector will use the Dagre layout
var maxImportLength = 500;//The max number of nodes that can be imported into a worksheet in one action

var workSheetLayout = goldenLayoutHTML.intiGoldenLayoutHTML();

var standardWorksheetCommands = [
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
		content: 'Remove neighbours',
		select: function(ele){
			openSubMenu(function(){
				remove_neighbours_from_worksheet(ele.data("id"));
			}, false, true);
		}
	},
	{
		content: 'Remove',
		select: function(ele){
			openSubMenu(function(){
				removeNode(ele);
			}, false, true);
		}
	},
	{
		content: 'Shortest path',
		select: function(ele){
			let eleID = ele.data().id;
			pathHandlers[`${eleID}`] = function(event){
				ele.cy().removeListener('tap', annotationHandlers[`${eleID}`]);
				pathHandlers[`${eleID}`] = null;
				let evtID = event.target.data().id;
				neo4jQueries.getShortestPath(eleID, evtID, function(results){
					graphingAPI.add_node_batch(results.nodes, worksheets[0].graph);
					neo4jQueries.get_all_edges_batch(results.nodes.map(function(ele){
						return parseInt(ele.id);
					}), function(edges){
						graphingAPI.add_edge_batch(edges.concat(results.edges), worksheets[0].graph);
					});
				});
			}
			ele.cy().on('tap', 'node', pathHandlers[`${eleID}`]);
		}
	},
];

var worksheetChildCxtMenu = ({
	menuRadius: 140,
	separatorWidth: 5,
	selector: 'node[type != "annotation"]:childless',
	commands: [
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
	].concat(standardWorksheetCommands)
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
				}, false, true);
			}
		},
	]
});

var worksheetAnnotationCxtMenu = ({
	menuRadius: 140,
	separatorWidth: 5,
	selector: 'node.annotation',
	commands: [
		{
			content: `Toggle selection connections`,
			select: function(ele){
				let eleID = ele.data().id;
				if(ele.data().connectionOn){
					ele.removeClass('annotationActive');
					ele.data().connectionOn = false;
					ele.cy().removeListener('tap', annotationHandlers[`${eleID}`]);
					annotationHandlers[`${eleID}`] = null;
				}
				else{
					ele.addClass('annotationActive');
					ele.data().connectionOn = true;
					annotationHandlers[`${eleID}`] = function(event){
						let evtID = event.target.data().id;
						if(evtID == eleID){return;}
						if (!ele.allAreNeighbors(`#${evtID}`)){
							neo4jQueries.createAnnotationEdge(eleID, evtID, function(edge){
								graphingAPI.add_edge(edge, ele.cy());
							});
						}
						else{
							neo4jQueries.deleteAnnotationEdge(eleID, evtID);
							ele.edgesWith(`#${evtID}`).remove();
						}
					};
					ele.cy().on('tap', 'node', annotationHandlers[`${eleID}`]);
				}
			}
		},
		{
			content: 'Edit Details',
			select: function(ele){
				openAnnotationMenu(ele);
			}
		},
	].concat(standardWorksheetCommands)
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

var worksheetCxtMenus = [worksheetChildCxtMenu, worksheetParentCxtMenu, worksheetAnnotationCxtMenu];
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
	generateOptions();
	if(document.getElementById("NodeSearchsheet") != null){
		neo4jQueries.neo4jLogin(eventEmitter, function(){
			update_nodelist();
		});
		workSheetLayout.emit(`NodeSearchsheetContainerCreated`);
	}
	if(document.getElementById("inspectorGraph") != null){
		createInspector();
	}
	if(document.getElementById(`worksheetGraph${getWorksheetCount()}`) != null){
		createWorksheet();
	}
	reportGenGraph = graphingAPI.create(`reportGenGraph`);

	document.getElementById(`toggleNodeSearchsheet`).onclick = function () {
		if(document.getElementById("NodeSearchsheet") != null){
			document.getElementById("toggleNodeSearchsheet").innerHTML = "Open NodeSearchsheet";
			nodeSearchsheetContainer._config.isClosable = true;
			nodeSearchsheetContainer.close();
		}
		else{
			document.getElementById("toggleNodeSearchsheet").innerHTML = "Close NodeSearchsheet";
			goldenLayoutHTML.addNodeSearchsheet(workSheetLayout);
			connectNodeListAccordion();
			update_nodelist();
		}
	};

	document.getElementById(`toggleAnnotationReport`).onclick = function () {
		toggleBlockNone("worksheetPage");
		toggleBlockNone("reportGenMenu", function(){
			document.getElementById("toggleAnnotationReport").innerHTML = 'Close Annotation Report Saver';
			openSaveAnnotationMenu();
		}, function(){
			document.getElementById("toggleAnnotationReport").innerHTML = 'Open Annotation Report Saver';
			workSheetLayout.updateSize();
		});
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
				contentItem.parent.header.controlsContainer.find('.lm_maximise').hide();
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

//General Events

//This is so the native context menu will not spawn
$("body").on("contextmenu", function(e){
	return false;
});

//General Events end

//Worksheet Events

workSheetLayout.on(`WorksheetContainerCreated`, function(fn){
	createWorksheet();
	fn();
});

workSheetLayout.on(`itemDestroyed`, function(item){
	if(item.componentName == "Worksheet"){
		worksheets.splice(worksheets.indexOf(worksheets[`${item.container.worksheetID}`]), 1);
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
	setConfidenceSilder(`confidenceSliderSearch`, `confidenceValueSearch`, update_nodelist);
});

//NodeSearchsheet Events end

//ReportGen Events

document.getElementById(`reportDagre`).onclick = function () {
	graphingAPI.layout( reportGenGraph, 'dagre');
};

document.getElementById(`reportCose`).onclick = function () {
	graphingAPI.layout( reportGenGraph, 'cose-bilkent');
};

//ReportGen Events end

//Popout Events 

// workSheetLayout.on('windowOpened', function( id ){
// 	workSheetLayout.eventHub.emit('inspectorWindowOpened', lastInspectedId, neo4jQueries);
// });

// var once = false; // should find a better way to make sure windows only load once

// workSheetLayout.eventHub.on('inspectorWindowOpened', function( id, currNeo4jQueries ){
// 	if(document.getElementById("NodeSearchsheet") != null && !once){
// 		once = true;
// 		workSheetLayout.eventHub.emit('updateInspectTargets',
// 										$('#inspectFiles').is(':checked'),
// 										$('#inspectSockets').is(':checked'),
// 										$('#inspectPipes').is(':checked'),
// 										$('#inspectProcessMeta').is(':checked'));
// 	}
// 	if(document.getElementById("inspectorGraph") != null){
// 		neo4jQueries = currNeo4jQueries;
// 		lastInspectedId = id;
// 		inspectAsync(id);
// 	}
// });

// workSheetLayout.on('windowClosed', function( id ){
// 	once = false;
// 	if(document.getElementById("inspectorGraph") != null){
// 		createInspector();
// 		inspect_node(lastInspectedId);
// 	}
// });

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
		refreshGraph(worksheetGraph);
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

	document.getElementById(`addAnnotation${index}`).onclick = function () {
		neo4jQueries.createAnnotationNode(function(node){
			graphingAPI.add_node(node, worksheets[`${index}`].graph);
			if($('#filterNodeType').val() == 'annotation'){
				update_nodelist();
			}
		})
	};

	document.getElementById(`acAnnotation${index}`).onclick = function () {
		neo4jQueries.createAnnotationNode(function(annNode){
			let graphIds = [];
			worksheets[`${index}`].graph.nodes().forEach(function(node){
				graphIds = graphIds.concat(parseInt(node.id()));
			});
			graphingAPI.add_node(annNode, worksheets[`${index}`].graph);
			neo4jQueries.createAnnotationEdgeBatch(annNode.id, graphIds, function(edges){
				graphingAPI.add_edge_batch(edges, worksheets[`${index}`].graph);
			});
			if($('#filterNodeType').val() == 'annotation'){
				update_nodelist();
			}
		})
	};

	setConfidenceSilder(`confidenceSlider${index}`, `confidenceValue${index}`, function(){
		//worksheetGraph.remove();
	});

	connectNodeListAccordion();

	// document.getElementById(`saveAnnotation${index}`).onclick = function () {
	// 	vex.dialog.confirm({
	// 		message: 'WARNING this action will delete all annotation nodes in database.',
	// 		className: 'vex-theme-wireframe',
	// 		callback: function (value) {
	// 			if(!value){return;}
	// 			neo4jQueries.deleteEmptyAnnotationNodes();
	// 		}
	// 	});
	// };
	goldenLayoutHTML.incrementWorksheetCount();
}

function addNewWorksheet(){
	goldenLayoutHTML.addWorksheet(workSheetLayout, function(){
		const graph = worksheets[`${getWorksheetCount() -1}`].graph;
		let temp = workSheetLayout.root.contentItems[ 0 ].contentItems;
		temp[ temp.length-1 ].on('resize', function(){
			refreshGraph(graph);
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

function toggleSection(ele){
	let eleID = ele.data().id;
	if(ele.data().connectionOn){
		ele.removeClass('annotationActive');
		ele.data().connectionOn = false;
		ele.cy().removeListener('tap', annotationHandlers[`${eleID}`]);
		annotationHandlers[`${eleID}`] = null;
	}
	else{
		ele.addClass('annotationActive');
		ele.data().connectionOn = true;
		annotationHandlers[`${eleID}`] = function(event){
			let evtID = event.target.data().id;
			if(evtID == eleID){return;}
			if (!ele.allAreNeighbors(`#${evtID}`)){
				neo4jQueries.createAnnotationEdge(eleID, evtID, function(edge){
					graphingAPI.add_edge(edge, ele.cy());
				});
			}
			else{
				neo4jQueries.deleteAnnotationEdge(eleID, evtID);
				ele.edgesWith(`#${evtID}`).remove();
			}
		};
		ele.cy().on('tap', 'node', annotationHandlers[`${eleID}`]);
	}
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

	//setRefreshGraphOnElementShow('inspectorGraph', inspector.graph);

	setInspectorCxtMenu();

	$('input[id *= "inspect"]').on('change', function() {
		workSheetLayout.eventHub.emit('updateInspectTargets',
										$('#inspectFiles').is(':checked'),
										$('#inspectSockets').is(':checked'),
										$('#inspectPipes').is(':checked'),
										$('#inspectProcessMeta').is(':checked')
		 );
		refresh_inspect();
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

	setConfidenceSilder(`confidenceSliderInspector`, `confidenceValueInspector`, refresh_inspect);
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
	if(document.getElementById("NodeSearchsheet") == null){return;}
	removeOverFlow(`nodeList`);
	showNodeListNextPrevious();
}

function showNodeListNextPrevious(fn=null){
	let nodelist = $('#nodelist');
	nodelist.empty();
	let row = document.getElementById("nodelist").insertRow(0);
	let cell = row.insertCell(0);
	cell.innerHTML = (`<td>Searching...</td>`);

	neo4jQueries.get_nodes($('#filterNodeType').val(),
							$('#filterName').val(),
							$('#filterHost').val(),
							$('#filterLocalIp').val(),
							$('#filterLocalPort').val(),
							$('#filterRemoteIp').val(), 
							$('#filterRemotePort').val(),
							$('#filterfileNameStart').val(), 
							$('#filterfileNum').val(),
							$('#filterstartDate').val(), 
							$('#filterendDate').val(),
							$('#confidenceValueSearch').val(),
							overFlowVars[`nodeList`][`DisplayAmount`] + 1,
							overFlowVars['nodeList'][`IDStart`],
							false,
		function(result) {
			nodelist.empty();

			updateOverFlow('nodeList', result);

			if(result.length == 0){
				row = document.getElementById("nodelist").insertRow(0);
				cell = row.insertCell(0);
				cell.innerHTML = (`<td>No results found</td>`);
			}
			else{
				for (let node of result) {
					let meta = graphingAPI.node_metadata(node);

					row = document.getElementById("nodelist").insertRow(0);
					row.onclick = (function() {
						inspectAsync(node.id);
					});
					cell = row.insertCell(0);
					cell.innerHTML = (`<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
										<td>${meta.timestamp}</td>
										<td><a>${meta.label}</a></td>
									`);
				}
			}
			if(fn != null){
				fn();
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
							$('#filterfileNameStart').val(), 
							$('#filterfileNum').val(),
							$('#filterstartDate').val(), 
							$('#filterendDate').val(),
							$('#confidenceValueSearch').val(),
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

function refresh_inspect(){
	if(overFlowVars['inspector'][`inspectee`] == -1){return;}
	inspect_node(overFlowVars['inspector'][`inspectee`]);
}

//
// Displays the selected node and neighbours in the Inspector window
//
function inspect_node(id) {
	removeOverFlow('inspector');
	overFlowVars['inspector'][`inspectee`] = id;
	showInspectorNextPrevious();
}

function showInspectorNextPrevious(fn=null){
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
					}, true, false, true);
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
			if (inspector.graph.edges().length <= limitNodesForDagre) {
				graphingAPI.layout(inspector.graph, 'dagre');
			} else {
				graphingAPI.layout(inspector.graph, 'cose-bilkent');
			}

			inspector.graph.zoom({
				level: 1,
				position: inspector.graph.inspectee.position(),
			});
			if(fn != null){
				fn();
			}
		}
	);
}

function getInspectorCount(fn){
	get_neighbours(overFlowVars['inspector'][`inspectee`], false,
		0, 0, 
		function(result) {
			fn(result);
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
										countOnly,
										$('#confidenceValueInspector').val());
}

function import_batch_into_worksheet(nodes) {
	let graph = worksheets[`${selectedWorksheet}`].graph;
	let ids = [];

	for(let i = 0; i < nodes.length; i++){
		if (!graph.$id(nodes[i].id).empty()) {
			nodes.splice(nodes.indexOf(nodes[i]), 1);
			i--;
		}
		else{
			ids = ids.concat(nodes[i].id);

			if(ids.length > maxImportLength){
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
							<button type="button" class="headerButton" id="toggleAnnotationReport">Open Annotation Report Saver</button>
							<div class="dropdown" id="optionsForm"></div>
						</div>
						<div class="row content notScrollable" style="padding: 0.5%;display:block;" id="worksheetPage"></div>
						<div class="row content notScrollable" style="padding: 0.5%;position:relative;display:none;" id="reportGenMenu">
							<div class="scrollable annotationReportList">
								<table class="table">
									<tbody id="annotationList"></tbody>
								</table>
							</div>
							<div class="scrollable annotationReport">
								<label for="reportTitle">Title:</label><br>
								<input id="reportTitle" class="textBox leftPadding" value=""></input><br><br>
								<label for="reportGenGraph">Graph:</label><br>
								<div class="annotationReportGraph">
									<div id="reportGenGraph" class="sheet"></div>
									<div class="bottomOptions">
										<button type="button" class="headerButton" id="reportDagre">Dagre</button>
										<button type="button" class="headerButton" id="reportCose">Cose</button>
									</div>	
								</div><br>
								<label for="reportDescription">Description:</label><br>
								<textarea id="reportDescription" class="textBox leftPadding" rows="4" cols="50"></textarea><br><br>
								<button type="button" class="headerButton" id="saveToNode">Update Annotation Node to db</button>
								<button type="button" class="headerButton" id="saveReport">Save Report</button><br><br>
							</div>
						</div>`;
	return element;
}

function generateOptions(){
	let optionsForm = document.getElementById('optionsForm');
	let optionButton = document.createElement('button');
	optionButton.className = 'headerButton';
	optionButton.id = 'dropdownOptions';
	optionButton.innerHTML = 'Options';
	optionButton.onclick = (function(){
		toggleBlockNone(`optionMenu`);
	});
	optionsForm.appendChild(optionButton);
	attachOptionForm(optionsForm);
}

function attachOptionForm(optionsForm){
	let optionMenu = document.getElementById('optionMenu');
	if(optionMenu == null){
		optionMenu = document.createElement('a');
	}
	optionMenu.className = 'popoutMenu';
	optionMenu.id = 'optionMenu';
	optionMenu.innerHTML = `<h2>Options</h2>
							<font>GUI_Version: ${GUI_VERSION}</font><br><br>
							<label for="newNodeListDisplayAmount">Nodes shown in nodeList:</label><br>
							<input id="newNodeListDisplayAmount" class="textBox leftPadding" placeholder="${overFlowVars['nodeList']['DisplayAmount']}"></input><br>
							<label for="newInspectorDisplayAmount">Neighbours shown in Inspector:</label><br>
							<input id="newInspectorDisplayAmount" class="textBox leftPadding" placeholder="${overFlowVars['inspector']['DisplayAmount']}"></input><br>
							<label for="newMaxImportLength">Max amount of nodes importable:</label><br>
							<input id="newMaxImportLength" class="textBox leftPadding" placeholder="${maxImportLength}"></input><br>
							<label for="newLimitNodesForDagre">Inspector edge limit for Dagre layout:</label><br>
							<input id="newLimitNodesForDagre" class="textBox leftPadding" placeholder="${limitNodesForDagre}"></input><br>
							<label>Dark&nbsp;</label>
							<label class="switch">
								<input type="checkbox" id="styleSwitch">
								<span class="sliderCheck"></span>
							</label>
							<label>&nbsp;Light</label><br><br>`;

	let optionSubmit = document.createElement('button');
	optionSubmit.className = 'headerButton';
	optionSubmit.id = 'optionSubmit';
	optionSubmit.innerHTML = 'Apply';
	optionSubmit.onclick = (function(){
		if(utilFunc.testIfNumber($('#newNodeListDisplayAmount').val()) && $('#newNodeListDisplayAmount').val() > 0){
			overFlowVars['nodeList']['DisplayAmount'] = parseInt($('#newNodeListDisplayAmount').val());
		}
		if(utilFunc.testIfNumber($('#newInspectorDisplayAmount').val()) && $('#newInspectorDisplayAmount').val() > 0){
			overFlowVars['inspector']['DisplayAmount'] = parseInt($('#newInspectorDisplayAmount').val());
		}
		if(utilFunc.testIfNumber($('#newMaxImportLength').val()) && $('#newMaxImportLength').val() > 0){
			maxImportLength = parseInt($('#newMaxImportLength').val());
		}
		if(utilFunc.testIfNumber($('#newLimitNodesForDagre').val()) && $('#newLimitNodesForDagre').val() > 0){
			limitNodesForDagre = parseInt($('#newLimitNodesForDagre').val());
		}

		let graphs = worksheets.map(a => a.graph).concat(inspector.graph).concat(reportGenGraph);
		let isLight = $('#styleSwitch').is(':checked');
		darkTheme.disabled= isLight;
		lightTheme.disabled= !isLight;
		darkGoldTheme.disabled= isLight;
		lightGoldTheme.disabled= !isLight;
		graphingAPI.swapStyle(!$('#styleSwitch').is(':checked'), graphs);

		refresh_inspect();
		update_nodelist();
		document.getElementById('dropdownOptions').click();
		attachOptionForm(optionsForm);
	});
	optionMenu.appendChild(optionSubmit);
	optionsForm.appendChild(optionMenu);
}

function validOptionInput(varToSet, input){
	if(utilFunc.testIfNumber(input) && input > 0){
		varToSet = parseInt(input);
	}
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

// function setRefreshGraphOnElementShow(watchElement, graph){
// 	let targetNode = document.getElementById(watchElement).parentElement.parentElement;
// 	let observer = new MutationObserver(function(){
// 		if(targetNode.style.display !='none' && graph != null){
// 			refreshGraph(graph);
// 		}
// 	});
// 	observer.observe(targetNode,  { attributes: true, childList: true });
// }

function openSaveAnnotationMenu(){
	refreshGraph(reportGenGraph);
	let title = null;
	let description = null;
	$('#annotationList').empty();
	neo4jQueries.getAnnotationNodes(function(nodes){
		for (let node of nodes) {
			let meta = graphingAPI.node_metadata(node);
			let row = document.getElementById('annotationList').insertRow(0);
			if(rowReportSelected != null && rowReportSelected.id == node.id){
				rowReportSelected.row = row;
			}
			row.onclick = (function() {
				if(title != null && description != null && 
					(title != document.getElementById('reportTitle').value ||
						description != document.getElementById('reportDescription').value)){
					vex.dialog.confirm({
						message: 'Changes have been made. Are you sure you wish to discard them?',
						className: 'vex-theme-wireframe',
						callback: function (value) {
							if(!value){return;}
							rowReportSelected = {'row':row, 'id':node.id};
							updateReportPanel(node.id, title, description, function(newTitle, newDescription){
								title = newTitle;
								description = newDescription;
							});
						}
					});
				}
				else{
					rowReportSelected = {'row':row, 'id':node.id};
					updateReportPanel(node.id, title, description, function(newTitle, newDescription){
						title = newTitle;
						description = newDescription;
					});
				}
			});
			row.innerHTML = (`<td><a>${meta.label}</a></td>`);
		}
	});

	document.getElementById('saveToNode').onclick = function(){
		let newTitle = document.getElementById('reportTitle').value;
		setAnnotationNode(reportGenGraph.inspectee, newTitle, 
			document.getElementById('reportDescription').value,
				function(){
					rowReportSelected.row.innerHTML = (`<td><a>${newTitle}</a></td>`);
				});
	};

	document.getElementById('saveReport').onclick = function(){
		let report = {'title':document.getElementById('reportTitle').value, 
					'png': reportGenGraph.png(),
					'description':document.getElementById('reportDescription').value};
		let string = '## Title:\n' + report.title + '\n\n## Description:\n' + report.description;
		reportGenGraph.nodes().forEach(function(node){
			let data = node.data();
			let keys = Object.keys(data);
			let table = `\n\n.${data.label} #${data.id}\n|===\n|property |value\n\n`;
			keys.forEach(function(key){
				table += `|${key}\n|${data[key]}\n\n`;
			})
			table += `|===\n\nimage:./${report.title}.png`;
			string += table;
		})
		let blob = new Blob([ string ]);
		let a = document.createElement('a');

		let title = report.title;
		if(title = ''){
			title = 'report';
		}
		a.download = report.title + `.adoc`;
		a.href= window.URL.createObjectURL(blob);

		a.click();

		a.download = report.title + `.png`;
		a.href= report.png;

		a.click();
	};
}

function updateReportPanel(id, title, description, fn){
	neo4jQueries.get_neighbours_id(id, function(neighbours){
		reportGenGraph.remove('node');
		reportGenGraph.inspectee = id;
		graphingAPI.add_node_batch(neighbours.nodes, reportGenGraph);
		neo4jQueries.get_all_edges_batch(neighbours.nodes.map(a => a.id), function(edges){
			graphingAPI.add_edge_batch(edges.concat(neighbours.edges), reportGenGraph);
		});
		neo4jQueries.getAnnotationNodeTitleDes(id, function(result){
			document.getElementById('reportTitle').value = result.title;
			$('#reportDescription').val(result.description);
			fn(result.title, result.description);
		})
	});
}


function openAnnotationMenu(ele){
	if(document.getElementById(`annotationDropdown${ele.data().id}`) != null){
		return;
	}
	let annotationMenu = document.createElement('div');
	annotationMenu.style.cssText = `left:${currMouseX}px;top:${currMouseY}px;`;
	annotationMenu.className = 'annotationEditMenu';
	annotationMenu.id = `annotationDropdown${ele.data().id}`;
	
	neo4jQueries.getAnnotationNodeTitleDes(ele.data().id, function(result){
		let title = result.title;
		let description = result.description;
		if(title == null){title = '';}
		if(description == null){description = '';}

		let subMenuOption = document.createElement('a');
		subMenuOption.innerHTML = `<label for="editTitle">Title:</label><br>
								<input id="editTitle" class="textBox leftPadding" value="${title}"></input><br>
								<label for="editDescription">Description:</label><br>
								<textarea  id="editDescription" class="textBox leftPadding" rows="4" cols="50">${description}</textarea><br><br>`
		annotationMenu.appendChild(subMenuOption);

		let annotationSubmit = document.createElement('button');
		annotationSubmit.className = 'headerButton';
		annotationSubmit.innerHTML = 'Apply';
		annotationSubmit.onclick = (function(){
			title = document.getElementById('editTitle').value;
			description = document.getElementById('editDescription').value;
			setAnnotationNode(ele.data().id, title, description);
			annotationMenu.remove();
		});
		annotationMenu.appendChild(annotationSubmit);

		let annotationCancel = document.createElement('button');
		annotationCancel.className = 'headerButton';
		annotationCancel.innerHTML = 'Close';
		annotationCancel.onclick = (function(){
			if(title != document.getElementById('editTitle').value ||
				description != document.getElementById('editDescription').value){
				vex.dialog.confirm({
					message: 'Changes have been made. Are you sure you wish to discard them?',
					className: 'vex-theme-wireframe',
					callback: function (value) {
						if(!value){return;}
						annotationMenu.remove();
					}
				});
			}
			else{
				annotationMenu.remove();
			}
		});
		annotationMenu.appendChild(annotationCancel);

		document.body.appendChild(annotationMenu);
	});
}

function openSubMenu(fn, isNewWorksheetOption = true, isAllWorksheetOption=false, leftClickSpawn = false){
	if_DOM_IDExsitsRemove("worksheetDropdown");
	let cxtSubMenu = document.createElement('div');
	cxtSubMenu.style.cssText = `left:${currMouseX}px;top:${currMouseY}px;`;
	cxtSubMenu.className = 'dropdown-content';
	cxtSubMenu.id = 'worksheetDropdown';

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
	if(isAllWorksheetOption){
		let SubMenuOption = document.createElement('a');
		SubMenuOption.text = `All Worksheet`;
		SubMenuOption.onclick =(function() {
			for(let i in worksheets){
				selectedWorksheet = i;
				fn();
			}
		});
		cxtSubMenu.appendChild(SubMenuOption);
	}
	document.body.appendChild(cxtSubMenu);
	window.onclick = function(event) {
		if(!leftClickSpawn){//this is here so SubMenu is usable with a left click
			document.getElementById(`worksheetDropdown`).remove();
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

function if_DOM_IDExsitsRemove(id, fn=null){
	if(fn != null){
		fn(document.getElementById(id) != null);
	}
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
		overFlowVars[name][`func`](function(){
			overFlowVars[name][`startDisplayNum`] -= overFlowVars[name][`DisplayAmount`];
			updateOverFlowText(name);
			UILock = false;
		});
	}
}

function getNextNodes(name){
	if(overFlowVars[name][`IDStart`] != overFlowVars[name][`IDNextStart`] && 
		overFlowVars[name][`IDNextStart`] != overFlowVars[name][`IDEnd`] && 
		!UILock){
		UILock = true;
		overFlowVars[name][`LastLowestShownIDs`] = overFlowVars[name][`LastLowestShownIDs`].concat(overFlowVars[name][`IDStart`]);
		overFlowVars[name][`IDStart`] = overFlowVars[name][`IDNextStart`];
		overFlowVars[name][`func`](function(){
			overFlowVars[name][`startDisplayNum`] += overFlowVars[name][`DisplayAmount`];
			updateOverFlowText(name);
			UILock = false;
		});
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
				}, true, false, true);
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

function setConfidenceSilder(slider, textbox, fn){
	slider = document.getElementById(slider);
	textbox = document.getElementById(textbox);
	slider.oninput = function () {
		textbox.value = slider.value/100;
		fn();
	};

	textbox.onchange = function () {
		if(!utilFunc.testIfNumber(textbox.value)){
			textbox.value = 0;
			slider.value = 0;
			return;
		}
		let value = Math.min(Math.max(textbox.value*100, 0), 100);
		slider.value = value;
		textbox.value = value/100;
	};
}

function toggleBlockNone(element, blockFn=null, noneFn=null){
	if('string' === typeof element){
		element = document.getElementById(element);
	}
	if (element.style.display === "none" || element.style.display == '') {
		element.style.display = "block";
		if(blockFn != null){
			blockFn();
		}
	} else {
		element.style.display = "none";
		if(noneFn != null){
			noneFn();
		}
	}
}

function setAnnotationNode(id, label, description, fn=null){
	neo4jQueries.setAnnotationNodeTitleDes(id, label, description,
		function(){
			if(fn != null){
				fn();
			}
			for(let worksheet of worksheets){
				worksheet.graph.$id(id).data('label', label);
			}
			inspector.graph.$id(id).data('label', label);

			if($('#filterNodeType').val() == 'annotation'){
				update_nodelist();
			}
		});
}

function connectNodeListAccordion(){
	for (let acc of document.getElementsByClassName("formBoxAccordion")) {
		acc.addEventListener("click", function() {
			toggleBlockNone(this.nextElementSibling);
		});
	}
}

//Utility Functions end

//Functions end