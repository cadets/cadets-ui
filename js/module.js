//******************Don't forget to close sessions!!!!!

//Worksheet Graph

var testGraph = create('worksheetGraph');

var worksheetGraph = {
	graph: testGraph
};

testGraph.cxtmenu( 
{
	menuRadius: 140,
	separatorWidth: 5,
	selector: 'node',
	commands: [
		{
			content: 'Inspect',//TODO: get row onclick working
			select: function(ele){
				inspect_node(ele.data('id'));
			}
		},
		{
			content: 'Import neighbours',
			select: function(ele){
			import_neighbours_into_worksheet(ele.data('id'));
			}
		},
		{
			content: 'Import successors',//TODO: check if correct
			select: function(ele){
			successors(ele.data('id'));
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
					file_read_query(id, function(result){
						let str = '';
						 result.forEach(function(name) {
							str += `<li>${name}</li>`;  // XXX: requires trusted UI server!
						 });
						 vex.dialog.alert({
							unsafeMessage: `<h2>Files read:</h2><ul>${str}</ul>`,
						 });
				});
			}
		},
		{
			content: 'Commands',
			select: function(ele){
				var id = ele.data('id');
				cmd_query(id, function(result) {
					let message = `<h2>Commands run by node ${id}:</h2>`;
					if (result.length == 0) {
						message += '<p>none</p>';
					} else {
						message += '<ul>';
						for (let command of result) {//TODO: ask if this is correct output
							message += `<li><a onclick="command_clicked(${command.dbid})">${command.cmdline}</a></li>`;
						}
						message += '</ul>';
					}
					vex.dialog.alert({ unsafeMessage: message });
				});
			}
		},
		{
			content: 'Remove neighbours',
			select: function(ele){
				remove_neighbours_from_worksheet(ele.data("id"));
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

//Worksheet Graph end

//Machine Graph

var machineGraph = create('machineGraph');

//Machine Graph end

//inspector Graph

var inspectorGraph = create('inspectorGraph');

var inspector = {
	detail: $('#inspector-detail'),
	neighbours: $('#neighbour-detail'),
	graph: inspectorGraph,
};
inspector.graph.inspectee = null;

inspectorGraph.cxtmenu({
	selector: 'node',
	commands: [
		{
			content: 'Import node',//TODO: get row onclick working
			select: function(ele){
				import_into_worksheet(ele.data('id'));		
		}
		},
		{
			content: 'Import neighbours',
			select: function(ele){
				import_neighbours_into_worksheet(ele.data('id'));
		}
		},
		{
			content: 'Inspect',//TODO: get row onclick working
			select: function(ele){
				inspect_node(ele.data("id"));
		}
		},
		{
			content: 'Import and Inspect',//TODO: get row onclick working
			select: function(ele){
				inspect_and_import(ele.data('id'));
		}
		},
	]
});


//inspector Graph end

//run
	var driver;

	neo4jLogin();

//run end

//Functions

function neo4jLogin(){
	vex.dialog.open({
		message: 'Enter your Neo4j username and password:',
		input: [
			'<input name="username" type="text" placeholder="Username" required /><br>',
			'<input name="password" type="password" placeholder="Password" required />'
		].join(''),
		buttons: [
			$.extend({}, vex.dialog.buttons.YES, { text: 'Login' })
		],
		callback: function (data) {
			var neo4j = window.neo4j.v1;
			if (!data) {
				console.log('Assuming no login authorization on Neo4j db. To relogin please refresh page.');
				driver = neo4j.driver("bolt://localhost", neo4j.auth.basic('', ''));
			} else {
				driver = neo4j.driver("bolt://localhost", neo4j.auth.basic(data.username, data.password));
			}

			setup_machines();

			$('input[id *= "filter"],select[id *= "filter"]').on('change', update_nodelist);

			$('input[id *= "inspect"]').on('change', function() {
				const node = inspector.graph.inspectee;
				if (node && !node.empty()) {
					inspect_node(node.id());
				}
			});
		}
	})
}

function remove_neighbours_from_worksheet(id) {
	let node = worksheetGraph.graph.$id(id);

	// First check to see if this is a compound node.
	let children = node.children();
	if (!children.empty()) {
		children.forEach(function (node) { worksheetGraph.graph.remove(node); });
		node.remove();
		return;
	}

	// Otherwise, remove edge-connected neighbours that aren't highlighted.
	node.connectedEdges().connectedNodes().filter(function(ele) {
	return !ele.hasClass('important');
	}).remove();
}

function toggle_node_importance(id) {
	nodes = worksheetGraph.graph.nodes(`node#${id}`);
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
	return get_neighbours_id(id,
							fn,
							files = $('#inspectFiles').is(':checked'),
							sockets = $('#inspectSockets').is(':checked'),
							pipes = $('#inspectPipes').is(':checked'),
							process_meta = $('#inspectProcessMeta').is(':checked')
							);
}

//
// Fetch successors to a node, based on some user-specified filters.
//
function get_successors(id, fn, err = console.log) {
	return successors_query(id,
					max_depth = 100,
					files = $('#inspectFiles').is(':checked'),
					sockets = $('#inspectSockets').is(':checked'),
					pipes = $('#inspectPipes').is(':checked'),
					process_meta = $('#inspectProcessMeta').is(':checked'),
					fn);
}

//
// How to import a node into the worksheet
//
function import_into_worksheet(id, err = console.log) {
	let graph = worksheetGraph.graph;

	// Have we already imported this node?
	if (!graph.getElementById(id).empty()) {
		return $.when(null);
	}

	let position = {
		x: graph.width() / 2,
		y: graph.height() / 2,
	};

	get_detail_id(id, function(result) {
		let promise = null;

		if ('parent' in result && graph.nodes(`[id="${result.parent}"]`).empty()) {
			promise = import_into_worksheet(result.parent);
		} else {
			promise = $.when(null);
		}

		promise.then(function() {
			add_node(result, graph, position);
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

function inspect_and_import(id) {
	import_into_worksheet(id);
	inspect_node(id);
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

//
// Define what it means to "inspect" a node.
//
function inspect_node(id, err = console.log) {
	// Display the node's details in the inspector "Details" panel.
	var inspectee;

	inspector.detail.empty();
	inspector.neighbours.empty();

	get_detail_id(id, function(result) {
		for (let property in result) {
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

			add_node(inspectee, inspector.graph);

			for (let n of result.nodes) {
				add_node(n, inspector.graph);

				let meta = node_metadata(n);
				// inspector.neighbours.append(`
				// 	<tr>
				// 		<td><a onclick="import_into_worksheet(${n.id})" style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
				// 		<td><a onclick="import_into_worksheet(${n.id})">${meta.label}</a></td>
				// 	</tr>
				// `);


				var table = document.getElementById("neighbour-detail");

				var row = table.insertRow(0);
				row.onclick = (function() {
					import_into_worksheet(n.id);
				});
				var cell = row.insertCell(0);
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
			//if (result.edges.length < 100) { TODO: get dagre layout online
			//	layout(inspector.graph, 'dagre');
			//} else {
				layout(inspector.graph, 'cose');
			//}

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
	let graph = worksheetGraph.graph;

	// Display the node's details in the inspector "Details" panel.
	get_successors(id, function(result) {

		let position = {
			x: graph.width() / 2,
			y: graph.height() / 2,
		};

		for (let n of result.nodes) {
			add_node(n, graph, position);
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
	get_nodes(node_type = $('#filterNodeType').val(),
			name = $('#filterName').val(),
			host = $('#filterHost').val(),
			local_ip = $('#filterLocalIp').val(),
			local_port = $('#filterLocalPort').val(),
			remote_ip = $('#filterRemoteIp').val(), 
			remote_port = $('#filterRemotePort').val(),
			limit = '100',
			function(result) {
				let nodelist = $('#nodelist');
				nodelist.empty();

				let current_uuid = null;
				let colour = 0;

				for (let node of result) {
					let meta = node_metadata(node);

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

					var table = document.getElementById("nodelist");

					var row = table.insertRow(0);
					row.onclick = (function() {
						inspect_node(node.id);
					});
					var cell = row.insertCell(0);
					cell.innerHTML = (`
										<td><a style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
										<td>${meta.timestamp}</td>
										<td><a>${meta.label}</a></td>
						`);
				}
			});//.fail(err);
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

function openPage(pageId){
	$('#machinePage').css('display', 'none');
	$('#notificationPage').css('display', 'none');
	$('#worksheetPage').css('display', 'none');
	$(pageId).css('display', 'block');
}

function refreshGraph(graphId){
	$(graphId).css('height', '99%');
	$(graphId).css('height', '100%');
}


//Functions end

//Parser


function parseNeo4jNode(o){
	var data = {'id': o['identity']['low']};
	var labels = o['labels'];
	if (labels.indexOf('Socket') > -1){//TODO: test socket
		data.type = "socket-version";
		data.names = o['properties']['name'];
		data.creation = o['properties']['timestamp']['low'];
		data.uuid = o['properties']['uuid'];
		data.host = o['properties']['host'];
		data.saw_creation = !o['properties']['anomalous'];
	}
	else if (labels.indexOf('Pipe') > -1){//TODO: test pipe
		data.type = "pipe-endpoint";
		data.creation = o['properties']['timestamp']['low'];
		//data.properties = o[properties];
	}
	else if (labels.indexOf('Process') > -1){
		data.type = "process";
		//data.properties = o['properties'];
		data.saw_creation = !o['properties']['anomalous'];
		data.cmdline = o['properties']['cmdline'];
		data.host = o['properties']['host'];
		data.egid = o['properties'][`meta_egid`];
		data.euid = o['properties'][`meta_euid`];
		data.gid = o['properties'][`meta_gid`];
		data.login = o['properties'][`meta_login`];
		data.ts = o['properties'][`meta_ts`]['low'];
		data.uid = o['properties'][`meta_uid`];
		data.pid = o['properties']['pid'];
		data.uuid = o['properties']['uuid'];
		data.status = o['properties']['status'];
		data.timestamp = o['properties']['timestamp'];
		data.thin = o['properties']['thin'];
	}
	else if (labels.indexOf('Machine') > -1){
		data.type = "machine";
		data.uuid = o['properties']['uuid'];
		data.ips = o['properties']['ips'];
		data.names = o['properties']['name'];
		data.first_seen = o['properties']['timestamp']['low'];
		data.external = o['properties']['external'];
	} 
	else if (labels.indexOf('Meta') > -1){
		data.type = "process-meta";
		data.egid = o['properties'][`meta_egid`];
		data.euid = o['properties'][`meta_euid`];
		data.gid = o['properties'][`meta_gid`];
		data.login = o['properties'][`meta_login`];
		data.ts = o['properties'][`meta_ts`]['low'];
		data.uid = o['properties'][`meta_uid`];
	}
	else if (labels.indexOf('Conn') > -1){//TODO: not many Conns to test with
		data.authority = o['properties'][`authority`];
		data.client = o['properties'][`client`];
		data.client_ip = o['properties'][`client_ip`];
		data.client_port = o['properties'][`client_port`];
		data.confidence = o['properties'][`confidence`];
		data.method = o['properties'][`method`];
		data.server = o['properties'][`server`];
		data.server_ip = o['properties'][`server_ip`];
		data.server_port = o['properties'][`server_port`];
		if(data['type'] != null){
			data['ctype'] = data['type'];
		} 
		else{
			data['ctype'] =  'TCP';
		}
		if (data['ctype'] == 'TCP'){
			data['endpoints'] = [data['client_ip'] + ":" + data['client_port'],
								data['server_ip'] + ":" + data['server_port']];
		}
		else if (data['ctype'] == 'Pipe'){
			data['endpoints'] = ['wrpipe: ' + short_hash(data['wrpipe']),
								'rdpipe: ' + short_hash(data['rdpipe'])];
		}
		data.type= "connection";
	}
	 else{
		data.type = "file-version";
		data.uuid = o['properties']['uuid'];
		data.host = o['properties']['host'];
		data.names = o['properties']['name'];
		data.creation = o['properties']['timestamp'];
		data.saw_creation = !o['properties']['anomalous'];
	}
	// if 'host' in o and o['host'] in self.machines{
	// 	(i, name) = self.machines[o['host']];
	// 	data.update({'hostname': name, 'parent': i});
	// }
	// // Calculate a short, easily-compared hash of something unique
	// // (database ID if we don't have a UUID)
	// unique = o['uuid'] if 'uuid' in o else str(o.id);
	// data['hash'] = short_hash(unique);
	return data;
}

function parseNeo4jEdge(o){
	var id = o['identity']['low'];
	var type_map = {'PROC_PARENT': 'parent'};
	type_map.PROC_OBJ = 'io';
	type_map.META_PREV = 'proc-metadata';
	type_map.PROC_OBJ_PREV = 'proc-change';
	type_map.GLOB_OBJ_PREV = 'file-change';
	type_map.COMM = 'comm';
	var state;
	var src;
	var dst;
	if (o['properties']['state'] != null){
		state = o['properties']['state'];
	} else{
		state = null;
	}
	if (state != null){
		if (state == "NONE"){
			state = null;
		}
		else if (state == "RaW"){
			state = ['READ', 'WRITE'];
		}
		else if ((state.indexOf('CLIENT') > -1) || (state.indexOf('SERVER') > -1)){
			state = [state, 'READ', 'WRITE'];
		}
		else if (state == "BIN"){
			state = [state, 'READ'];
		}
		else{
			state = [state];
		}
	}
	if (state != null && (state.indexOf('WRITE') <= -1)){
		src = o.start;
		dst = o.end;
	}
	if (o['type'] == 'COMM'){
		src = o['start']['low'];
		dst = o['end']['low'];
	}
	else{
		src = o.end;
		dst = o.start;
	}

	return {'source': src,
				'target': dst,
				'id': id,
				'type': type_map[o['type']],
				'state': state};
}

//Parser end

//Queries

// function notifications(){
// 	var alerts = [];

// 	if current_app.bro_location:
// 		with open(current_app.bro_location) as f:
// 			for l in f:
// 				bro_data = [p for p in l.split() if p != '']
// 				if (bro_data.length == 0){
// 					break;
// 				}

// 				alerts = alerts.concat({
// 					'local_ip': bro_data[7],
// 					'local_port': bro_data[8],
// 					'remote_ip': bro_data[9],
// 					'remote_port': bro_data[10],
// 					'timestamp': datetime.fromtimestamp(int(float(bro_data[5]))),
// 					'event': bro_data[15]
// 				});

// 	return flask.render_template('notifications.html', alerts = alerts)
// }


function file_read_query(id, fn){
	var session = driver.session();
	session.run(`MATCH (n:Process)<-[e:PROC_OBJ]-(c:File)
						WHERE id(n) = ${id} AND
							e.state in ['BIN', 'READ', 'RaW']
						RETURN c.name AS g_name`)
	.then(result => {
		session.close();
		if (result.length){
			console.log(404);
		}
		var files = [];
		result.records.forEach(function (record) 
		{
			files = files.concat(record.get('g_name'));
		});
		fn(files);
	});
}

function cmd_query(id, fn){
	var session = driver.session();
	session.run(`MATCH (n:Process)<-[:PROC_PARENT]-(c:Process) 
						WHERE id(n) = ${id} 
						RETURN c ORDER BY c.timestamp`)
	.then(result => {
		session.close();
		var cmds = [];
		result.records.forEach(function (record) 
		{
			cmds = cmds.concat(parseNeo4jNode(record.get('c')));
		});
		fn(cmds);
	});
}


function setup_machines() {
	var session = driver.session();
	session.run("MATCH (m:Machine) RETURN m")
	.then(result => {result.records.forEach(function (record) 
		{
			var nodeData = parseNeo4jNode(record.get('m'));
			add_node(nodeData, machineGraph);
		});
		session.run("MATCH (:Machine)-[e]->(:Machine) RETURN DISTINCT e")
		.then(result => {result.records.forEach(function (record) 
			{
				var edgeData = parseNeo4jEdge(record.get('e'));
				add_edge(edgeData, machineGraph);
			});
			session.close();
		});
		layout( machineGraph, 'cose');
	});
}

function get_neighbours_id(id, fn, files=true, sockets=true, pipes=true, process_meta=true){
	var session = driver.session();
	var neighbours;
	var root_node;
	var m_links;
	var m_nodes;
	var m_qry;
	var neighbour_nodes = [];
	var neighbour_edges = [];
	var matchers = ["Machine", "Process", "Conn"];
	if (files){
		matchers = matchers.concat('File');
	}
	if (sockets){
		matchers = matchers.concat('Socket');
	}
	if (pipes){
		matchers = matchers.concat('Pipe');
	}
	if (files && sockets && pipes){
		matchers = matchers.concat('Global');
	}
	if (process_meta){
		matchers = matchers.concat('Meta');
	}
	session.run(`MATCH (s)-[e]-(d)
				WHERE id(s) = ${id}
				AND NOT
				(
					"Machine" in labels(s)
					AND
					"Machine" in labels(d)
				)
				AND
				(
					NOT d:Pipe
					OR
					d.fds <> []
				)	
				AND
				any(lab in labels(d) WHERE lab IN ${JSON.stringify(matchers)})
				RETURN s, e, d`)

	.then(result => {
		neighbours = result.records;
		if (neighbours.length){
			root_node = neighbours[0].get('s');
			neighbour_nodes = neighbour_nodes.concat(parseNeo4jNode(root_node));
		}
		if (sockets){
			session.run(`MATCH (skt:Socket), (mch:Machine)
						WHERE 
						mch.external
						AND 
						id(skt)=${id}
						AND 
						split(skt.name[0], ":")[0] in mch.ips
						RETURN skt, mch
						UNION
						MATCH (skt:Socket), (mch:Machine)
						WHERE 
						mch.external
						AND 
						id(mch)=${id}
						AND
						split(skt.name[0], ":")[0] in mch.ips
						RETURN skt, mch`)
			.then(result => {
				m_qry = result;
				for(row in m_qry){
					m_links.id = (row['skt'].id + row['mch'].id);
					m_links.source = row['skt'].id;
					m_links.target = row['mch'].id;
					m_links.type = 'comm';
					m_links.state = null; 
					if(row['mch'] == null){
						m_nodes = row['skt'];
					}
					else{
						m_nodes = row['mch'];
					}
					neighbour_nodes = neighbour_nodes.concat(parseNeo4jNode(m_nodes));
					neighbour_edges = neighbour_edges.concat(parseNeo4jEdge(m_links));
				}
			});
		}
		for(row in neighbours){//maybe cause issues where it is not inside the the async
			neighbour_nodes = neighbour_nodes.concat(parseNeo4jNode(neighbours[row].get('d')));
			neighbour_edges = neighbour_edges.concat(parseNeo4jEdge(neighbours[row].get('e')));
		}
		session.close();
		fn({nodes: neighbour_nodes,
				edges: neighbour_edges});
	});
}

// function get_neighbours_uuid(uuid, files=True, sockets=True, pipes=True, process_meta=True){
// 	var matchers = ['Machine', 'Process', 'Conn'];
// 	if (files){
// 		matchers.add('File');
// 	}
// 	if (sockets){
// 		matchers.add('Socket');
// 	}
// 	if (pipes){
// 		matchers.add('Pipe');
// 	}
// 	if (files && sockets && pipes){
// 		matchers.add('Global');
// 	}
// 	if (process_meta){
// 		matchers.add('Meta');
// 	}

// 	var session = driver.session();
// 	var res = session.run(`MATCH (s)-[e]-(d)
// 						WHERE
// 						exists(s.uuid)
// 						AND 
// 						(
// 							NOT d:Pipe
// 							OR
// 							d.fds <> []
// 						)
// 						AND
// 						s.uuid=${uuid}
// 						AND
// 						any(lab in labels(d) WHERE lab IN ${list(matchers)})
// 						RETURN s, e, d`);

// 	if(res.length){
// 		var root_node = res[0]['s'];
// 	}
// 	else{
// 		var root_node = set();
// 	}
// 	//var root_node = {res[0]['s']} if len(res) else set();
// 	// return flask.jsonify({'nodes': {row['d'] for row in res} | root_node,
// 	// 					  'edges': {row['e'] for row in res}});
// }


function successors_query(dbid, max_depth=4, files=true, sockets=true, pipes=true, process_meta=true, fn){
	var matchers = [];
	if (files){
		matchers = matchers.concat('File');
	}
	if (sockets){
		matchers = matchers.concat('Socket');
	}
	if (pipes){
		matchers = matchers.concat('Pipe');
	}
	if (files && sockets && pipes){
		matchers = matchers.concat('Global');
	}
	if (!files && !sockets && !pipes){
		matchers = [];
	}
	var process_obj;
	var session = driver.session();
	get_detail_id_unparsed(dbid, function(result) {
		if (result == null){
			console.log(404);
		}
		process_obj = result;
		//process_obj = result.splice(0,max_depth-1);//[(max_depth, result)];
		//while (process_obj.length){
		//	nodes = nodes.concat(cur);
			if (process_obj['labels'] == ('Global')){
				session.run(`MATCH (cur:Global)-[e]->(n:Process)
										WHERE
										id(cur)=${dbid}
										AND
										e.state in ['BIN', 'READ', 'RaW', 'CLIENT', 'SERVER']
										RETURN n, e
										UNION
										MATCH (cur:Global)<-[e]-(n:Global)
										WHERE
										id(cur)=${dbid}
										AND
										(
											NOT n:Pipe
											OR
											n.fds <> []
										)
										AND
										NOT ${JSON.stringify(matchers)} is Null
										AND
										any(lab in labels(n) WHERE lab IN ${JSON.stringify(matchers)})
										RETURN n, e
										UNION
										MATCH (cur:Global)-[e]-(n:Conn)
										WHERE id(cur)=${dbid}
										RETURN n, e`)
				.then(result => {
					session.close();
					findEdges(dbid, result.records, fn);
				});
			}
			else if (process_obj['labels'] == ('Process')){
				session.run(`MATCH (cur:Process)<-[e]-(n:Global)
										WHERE
										id(cur)=${dbid}
										AND
										e.state in ['WRITE', 'RaW', 'CLIENT', 'SERVER']
										AND
										(
											NOT n:Pipe
											OR
											n.fds <> []
										)
										AND
										NOT ${JSON.stringify(matchers)} is Null
										AND
										any(lab in labels(n) WHERE lab IN ${JSON.stringify(matchers)})
										RETURN n, e
										UNION
										MATCH (cur:Process)<-[e]-(n:Process)
										WHERE id(cur)=${dbid}
										RETURN n, e`)
				.then(result => {
					session.close();
					findEdges(dbid, result.records, fn);
				});
			}
			else if (process_obj['labels'] == ('Conn')){
				session.run(`MATCH (cur:Conn)-[e]-(n:Global)
										WHERE
										id(cur)=${dbid}
										AND
										(
											NOT n:Pipe
											OR
											n.fds <> []
										)
										AND
										NOT ${JSON.stringify(matchers)} is Null
										AND
										any(lab in labels(n) WHERE lab IN ${JSON.stringify(matchers)})
										RETURN n, e`)
				.then(result => {
					session.close();
					findEdges(dbid, result.records, fn);
				});
			}
			// if (neighbours == null){
			// 	continue;
			// }
			// for (row in neighbours){
			// 	if ((row['n'] in nodes) != null || 
			// 		(row['n'] in process_obj.filter( d < (cur_depth - 1)))){
			// 		continue;
			// 	}
			// 	if (cur_depth > 0){
			// 		process_obj = process_obj.concat((cur_depth - 1, row['n']));
			// 	}
			// }
		//}
	});
}

function findEdges(curId, neighbours, fn){
		var session = driver.session();
		var ids = [];
		var nodes = [];
		neighbours.forEach(function (record) 
		{
			nodes = nodes.concat(parseNeo4jNode(record.get('n')));
			ids = ids.concat(record.get('n')['identity']['low']);
		});
		session.run(`MATCH (a)-[e]-(b) WHERE id(a) = ${curId} AND id(b) IN ${JSON.stringify(ids)} RETURN DISTINCT e`)
		.then(result => {
			session.close();
			var edges = [];
			result.records.forEach(function (record) 
			{
				edges = edges.concat(parseNeo4jEdge(record.get('e')));
			});
			fn({'nodes': nodes,
				'edges': edges});
			});
}

function get_detail_id(id, fn){
	var session = driver.session();
	session.run(`MATCH (n) WHERE id(n)=${id} RETURN n`)
	.then(result => {
		if (result == null){
			console.log(404);
		}
		session.close();
		fn(parseNeo4jNode(result.records[0].get('n')));
	});
}
function get_detail_id_unparsed(id, fn){
	var session = driver.session();
	session.run(`MATCH (n) WHERE id(n)=${id} RETURN n`)
	.then(result => {
		if (result == null){
			console.log(404);
		}
		session.close();
		fn(result.records[0].get('n'));
	});
}

// function get_detail_uuid(**kwargs){
// 	var session = driver.session();
// 	query = session.run(
// 			`MATCH (n) WHERE exists(n.uuid) AND n.uuid=${uuid} RETURN n`);
// 			//kwargs).single()
// 	if (query == null){
// 		console.log(404);
// 	}
// 	return flask.jsonify(query['n'])
// }

function get_nodes(node_type=null, 
				name=null, 
				host=null, 
				local_ip=null, 
				local_port=null, 
				remote_ip=null, 
				remote_port=null, 
				limit='100',
				fn){
	var lab;
	var node_labels = {'pipe-endpoint': 'Pipe',
					'socket-version': 'Socket',
					'process': 'Process',
					'machine': 'Machine',
					'process-meta': 'Meta',
					'connection': 'Conn',
					'file-version': 'Global'};
	if  (!(node_type in node_labels)){
		lab = "Null";
	}
	else{
		lab = node_labels[node_type];
	}
	if (local_ip == null || local_ip == ""){
		local_ip = ".*?";
	}
	if (local_port == null || local_port == ""){
		local_port = ".*?";
	}
	if (remote_ip == null || remote_ip == ""){
		remote_ip = ".*?";
	}
	if (remote_port == null || remote_port == ""){
		remote_port = ".*?";
	}
	var nodes = [];
	var session = driver.session();
	session.run(`MATCH (n)
				WHERE 
					${JSON.stringify(lab)} is Null
					OR
					${JSON.stringify(lab)} in labels(n)
				WITH n
				WHERE
					${JSON.stringify(name)} is Null
					OR
					${JSON.stringify(name)} = ''
					OR
					any(name in n.name WHERE name CONTAINS ${JSON.stringify(name)})
					OR
					n.cmdline CONTAINS ${JSON.stringify(name)}
				WITH n
				WHERE
					${JSON.stringify(host)} is Null
					OR
					${JSON.stringify(host)} = ''
					OR
					(
						exists(n.host)
						AND
						n.host = ${JSON.stringify(host)}
					)
					OR
					n.uuid = ${JSON.stringify(host)}
				WITH n
				MATCH (m:Machine)
				WHERE
					(
						n:Conn
						AND
						(
							n.client_ip=~${JSON.stringify(local_ip)}
							OR
							n.server_ip=~${JSON.stringify(local_ip)}
							OR
							(
								n.type = 'Pipe'
								AND
								${JSON.stringify(local_ip)} = '.*?'
							)
						)
						AND
						(
							n.client_port=~${JSON.stringify(local_port)}
							OR
							n.server_port=~${JSON.stringify(local_port)}
							OR
							(
								n.type = 'Pipe'
								AND
								${JSON.stringify(local_port)} = '.*?'
							)
						)
						AND
						(
							n.server_ip=~${JSON.stringify(remote_ip)}
							OR
							n.client_ip=~${JSON.stringify(remote_ip)}
							OR
							(
								n.type = 'Pipe'
								AND
								${JSON.stringify(remote_ip)} = '.*?'
							)
						)
						AND
						(
							n.server_port=~${JSON.stringify(remote_port)}
							OR
							n.client_port=~${JSON.stringify(remote_port)}
							OR
							(
								n.type = 'Pipe'
								AND
								${JSON.stringify(remote_port)} = '.*?'
							)
						)
					)
					OR
					(
						NOT n:Conn
						AND
						(
							NOT n:Socket
							OR
							(
								n:Socket
								AND
								any(name in n.name
								WHERE name =~ (${JSON.stringify(remote_ip)}+':?'+${JSON.stringify(remote_port)}))
								AND
								(
									${JSON.stringify(local_ip)} = ".*?"
									OR
									(
										m.uuid = n.host
										AND
										any(l_ip in m.ips
										WHERE l_ip = ${JSON.stringify(local_ip)})
									)
								)
							)
						)
					)
				RETURN DISTINCT n
				LIMIT ${limit}`)
	 .then(result => {
		session.close();
		result.records.forEach(function (record) 
		{
			nodes = nodes.concat(parseNeo4jNode(record.get('n')));
		});
		fn(nodes);
	 });
}

//Queries end

//Button logic

document.getElementById("machinesPageBtn").onclick = function () {
	openPage('#machinePage');
	refreshGraph('#machineGraph');
};

document.getElementById("notificationsPageBtn").onclick = function () {
	openPage('#notificationPage');
};

document.getElementById("WorksheetPageBtn").onclick = function () {
	openPage('#worksheetPage');
	refreshGraph('#worksheetGraph');
	refreshGraph('#inspectorGraph');
};

document.getElementById("hideAnalysisWorksheet").onclick = function () { 
	$('#analysisWorksheet').toggleClass('hide');
	$('#worksheet').toggleClass('expandedWorksheet');
	refreshGraph('#worksheetGraph');
};

document.getElementById("loadGraph").onchange = function () {
	load(this.files[0], worksheetGraph);
};

document.getElementById("saveGraph").onclick = function () {
	save(worksheetGraph.graph);
};

//layout from graphing.js
document.getElementById("reDagre").onclick = function () {
	//layout( worksheetGraph.graph, 'cose'); //TODO: get cDagre online
};

//layout from graphing.js
document.getElementById("reCose-Bilkent").onclick = function () { 
	layout( worksheetGraph.graph, 'cose'); //TODO: get cose-bilkent online
};

//Button logic ends