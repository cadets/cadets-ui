import $ from './../node_modules/jquery/dist/jquery.js';
import vex from './../node_modules/vex-js/dist/js/vex.combined.min.js';

import './../node_modules/vex-js/dist/css/vex.css';
import './../node_modules/vex-js/dist/css/vex-theme-wireframe.css';

var neo4jParser = require('./neo4jParser.js');
var neo4j = require('./../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js').v1;
var driver = null;
var pvm_version = null;


export function neo4jLogin(eventE){
	vex.dialog.open({
		message: 'Enter your Neo4j username and password:',
		input: [
			'<input name="username" type="text" placeholder="Username" required /><br>',
			'<input name="password" type="password" placeholder="Password" required />'
		].join(''),
		buttons: [
			$.extend({}, vex.dialog.buttons.YES, { text: 'Login' })
		],
    	className: 'vex-theme-wireframe',
		callback: function (data) {
			if (!data) {
				neo4jLogin(eventE);
			} else {//bolt://localhost
				driver = neo4j.driver("bolt://localhost:7687/", neo4j.auth.basic(data.username, data.password));
				let session = driver.session();
					session.run(`MATCH (n:DBInfo) RETURN n`)
					.then(function(result) {
						session.close();
						if(result.records.length > 0){
							pvm_version = result.records[0].get("n").properties.pvm_version
							neo4jParser.pvm_version = pvm_version;
							eventE.emit('pvm_version_set', pvm_version);
							if(pvm_version == null){
								vex.dialog.alert({message: "DataBase does not contain PVM version data.",
										className: 'vex-theme-wireframe'});
							}
						}
					},
					function(error) {
						neo4jLogin(eventE);
						neo4jError(error, session, "neo4jLogin");
					});
			}
		}
	})
}

export function file_read_query(id, fn){
	let query = '';
	switch(parseInt(pvm_version)){
		case(1):
			query = `MATCH (n:Process)<-[e:PROC_OBJ]-(c:File)
							WHERE id(n) = ${id} AND
								e.state in ['BIN', 'READ', 'RaW']
							RETURN c`;
			break;
		case(2):
			query = `MATCH (n:Process)<-[]-(c:File)
							WHERE id(n) = ${id}
							RETURN c`;
			break;
		default:
	}
	let session = driver.session();
	session.run(query)
	.then(result => {
		session.close();
		if (result.length){
			console.log(404);
		}
		let files = [];
		result.records.forEach(function (record) 
		{
			files = files.concat(record.get("c"));
		});
		fn(files);
	}, function(error) {
		neo4jError(error, session, "file_read_query");
	});
}

export function cmd_query(id, fn){
	let query = '';
	switch(parseInt(pvm_version)){
		case(1):
			query = `MATCH (n:Process)<-[:PROC_PARENT]-(c:Process) 
						WHERE id(n) = ${id} 
					RETURN c ORDER BY c.timestamp`;
			break;
		case(2):
			query = `MATCH (n:Process)<-[]-(c:Process) 
						WHERE id(n) = ${id} 
					RETURN c`;
			break;
		default:
	}
	let session = driver.session();
	session.run(query)
	.then(result => {
		session.close();
		let cmds = [];
		result.records.forEach(function (record) 
		{
			cmds = cmds.concat(neo4jParser.parseNeo4jNode(record.get('c')));
		});
		fn(cmds);
		
	}, function(error) {
		neo4jError(error, session, "cmd_query");
	});
}

export function get_neighbours_id(id, fn, files=true, sockets=true, pipes=true, 
								process_meta=true, isOverFlow=false, limit=-1, startID = 0){
	get_neighbours_id_batch([parseInt(id)], fn, files, sockets, pipes, 
							process_meta, isOverFlow, limit, startID,true);
}

export function get_neighbours_id_batch(ids,
										fn,
										files=true, 
										sockets=true, 
										pipes=true, 
										process_meta=true,
										isOverFlow=false,
										limit=-1,
										startID = 0,
										includeRoot_node=false){
	let session = driver.session();
	let neighbours;
	let m_nodes;
	let m_qry;
	let neighbour_nodes = [];
	let neighbour_edges = [];
	let matchers = ["Machine", "Process", "Conn"];
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
	let limitQuery = '';
	let startQuery = '';
	if(limit != -1 && isOverFlow){
		limitQuery = `Limit ${limit}`;
	}
	if(startID != -1 && isOverFlow){
		startQuery =`id(d) <= ${startID}
					AND`;
	}
	session.run(`MATCH (s)-[e]-(d)
				WHERE 
				${startQuery}
				id(s) IN ${JSON.stringify(ids)}
				AND
				any(lab in labels(d) WHERE lab IN ${JSON.stringify(matchers)})
				RETURN DISTINCT s, e, d
				${limitQuery}`)

	.then(result => {
		neighbours = result.records;
		if (neighbours.length){
			if(includeRoot_node){
				neighbour_nodes = neighbour_nodes.concat(neo4jParser.parseNeo4jNode(neighbours[0].get('s')));
			}
			for(let row in neighbours){
				neighbour_nodes = neighbour_nodes.concat(neo4jParser.parseNeo4jNode(neighbours[row].get('d')));
				neighbour_edges = neighbour_edges.concat(neo4jParser.parseNeo4jEdge(neighbours[row].get('e')));
			}
		}
		if (sockets){
			session.run(`MATCH (skt:Socket), (mch:Machine)
						WHERE 
						mch.external
						AND 
						id(skt) IN ${JSON.stringify(ids)}
						AND 
						split(skt.name[0], ":")[0] in mch.ips
						RETURN skt, mch
						UNION
						MATCH (skt:Socket), (mch:Machine)
						WHERE 
						mch.external
						AND 
						id(mch) IN ${JSON.stringify(ids)}
						AND
						split(skt.name[0], ":")[0] in mch.ips
						RETURN DISTINCT skt, mch`)
			.then(result => {
				session.close();
				if(result.records.length > 0){
					neighbour_nodes = neighbour_nodes.concat(neo4jParser.parseNeo4jNode(result.records[0].get('mch')));
				}
				result.records.forEach(function (record){
					let m_links = {'type' : 'comm'};
					m_links.identity = {'low' : record.get('skt')['identity']['low'] + record.get('mch')['identity']['low']};
					m_links.properties = {'state' : null}; 
					m_links.start = {'low' : record.get('skt')['identity']['low']};
					m_links.end = {'low' : record.get('mch')['identity']['low']};
					neighbour_nodes = neighbour_nodes.concat(neo4jParser.parseNeo4jNode(record.get('skt')));
					neighbour_edges = neighbour_edges.concat(neo4jParser.parseNeo4jEdge(m_links));
				});
				fn({nodes: neighbour_nodes,
					edges: neighbour_edges});
			}, function(error) {
				neo4jError(error, session, "get_neighbours_id");
			});
		}
		else{
			session.close();
			fn({nodes: neighbour_nodes,
				edges: neighbour_edges});
		}
	}, function(error) {
		neo4jError(error, session, "get_neighbours_id");
	});
}

export function successors_query(dbid, max_depth=4, files=true, sockets=true, pipes=true, process_meta=true, fn){
	let matchers = [];
	// matchers = matchers.concat("Process");
	// matchers = matchers.concat("Conn");
	// matchers = matchers.concat("Machine");
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
	let process_obj;
	let session = driver.session();
	get_detail_id(dbid, function(result) {

		if (result[0] == null){
			console.log(404);
		}
		process_obj = result[0];
		//process_obj = result[0].splice(0,max_depth-1);//[(max_depth, result[0])];
		//while (process_obj.length){
		//	nodes = nodes.concat(cur);
			if (process_obj.labels.indexOf('Global') > -1){
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
				}, function(error) {
					neo4jError(error, session, "successors_query");
				});
			}
			else if (process_obj.labels.indexOf('Process') > -1){
				session.run(`MATCH (cur:Process)<-[e]-(n:Global)
							WHERE
								id(cur)=${dbid}
								AND
								e.state in ['WRITE', 'RaW', 'CLIENT', 'SERVER']
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
				}, function(error) {
					neo4jError(error, session, "successors_query");
				});
			}
			else if (process_obj.labels.indexOf('Conn') > -1 ){
				session.run(`MATCH (cur:Conn)-[e]-(n:Global)
							WHERE
								id(cur)=${dbid}
								AND
								NOT ${JSON.stringify(matchers)} is Null
								AND
								any(lab in labels(n) WHERE lab IN ${JSON.stringify(matchers)})
							RETURN n, e`)
				.then(result => {
					session.close();
					findEdges(dbid, result.records, fn);
				}, function(error) {
					neo4jError(error, session, "successors_query");
				});
			}
			// if (neighbours == null){
			// 	continue;
// 		}
			// for (row in neighbours){
			// 	if ((row['n'] in nodes) != null || 
			// 		(row['n'] in process_obj.filter( d < (cur_depth - 1)))){
			// 		continue;
// 			}
			// 	if (cur_depth > 0){
			// 		process_obj = process_obj.concat((cur_depth - 1, row['n']));
// 			}
// 			}
// }
	}, false);
}

function findEdges(curId, neighbours, fn){
		let session = driver.session();
		let ids = [];
		let nodes = [];
		neighbours.forEach(function (record) 
		{
			nodes = nodes.concat(neo4jParser.parseNeo4jNode(record.get('n')));
			ids = ids.concat(record.get('n')['identity']['low']);
		});
		session.run(`MATCH (a)-[e]-(b) WHERE id(a) = ${curId} AND id(b) IN ${JSON.stringify(ids)} RETURN DISTINCT e`)
		.then(result => {
			session.close();
			let edges = [];
			result.records.forEach(function (record) 
			{
				edges = edges.concat(neo4jParser.parseNeo4jEdge(record.get('e')));
			});
			fn({'nodes': nodes,
				'edges': edges});
			}, function(error) {
				neo4jError(error, session, "findEdges");
			});
}

export function get_detail_id(id, fn, parse=true){
	get_batch_detail_id([parseInt(id)], fn, parse=true);
}

export function get_batch_detail_id(ids, fn, parse=true){
	let session = driver.session();
	session.run(`MATCH (n) WHERE id(n) IN ${JSON.stringify(ids)} RETURN n`)
	.then(result => {
		session.close();
		if (result == null){
			console.log(404);
		}
		let nodes = [];
		result.records.forEach(function (record){
			if(parse){
				nodes = nodes.concat(neo4jParser.parseNeo4jNode(record.get('n')));
			}
			else{
				nodes = nodes.concat(record.get('n'));
			}
		});
		fn(nodes);
	}, function(error) {
		neo4jError(error, session, "get_batch_detail_id");
	});
}

export function get_nodes(node_type=null, 
				name=null, 
				host=null, 
				local_ip=null, 
				local_port=null, 
				remote_ip=null, 
				remote_port=null, 
				limit='100',
				startID = 0,
				countOnly = false,
				fn){
	let lab;
	let node_labels = {'pipe-endpoint': 'Pipe',
					'socket-version': 'Socket',
					'process': 'Process',
					'machine': 'Machine',
					'process-meta': 'Meta',
					'connection': 'Conn',
					'file-version': 'File',
					'global-only': 'Global'};
	let labelQuery;
	if  (!(node_type in node_labels)){
		lab = "Null";
	}
	else{
		lab = node_labels[node_type];
	}
	if(lab != 'Global'){
		labelQuery = `${JSON.stringify(lab)} in labels(n)`;
	}
	else{
		labelQuery = `n:Global AND NOT n:File AND NOT n:Socket AND NOT n:Pipe`;
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
	let returnQuery;
	let idQuery = ``;
	let query;
	if(countOnly == true){
		returnQuery = 'DISTINCT count(n)';
	}
	else{
		returnQuery = `DISTINCT n
						LIMIT ${limit}`;
		idQuery = `WHERE 
						id(n) >= ${startID}
					WITH n`;
	}
	if(pvm_version == 2){
		query = `MATCH (n) WHERE ${labelQuery} AND id(n) >= ${startID} RETURN ${returnQuery}`;
	}
	else {
		query = `MATCH (n)
				${idQuery}
				WHERE 
					${JSON.stringify(lab)} is Null
					OR
					${labelQuery}
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
				RETURN ${returnQuery}`;
	}
	let session = driver.session();
	session.run(query)
	 .then(result => {
		session.close();
		//console.log(result);
		let nodes = [];
		if(countOnly){
			fn(result.get('n'));
		}
		else{
			result.records.forEach(function (record) 
			{
				nodes = nodes.concat(neo4jParser.parseNeo4jNode(record.get('n')));
			});
		}
		fn(nodes);
	 }, function(error) {
		neo4jError(error, session, "get_nodes");
	});
}

export function getTypeLabels(fn){
	let session = driver.session();
	session.run(`CALL db.labels()`)
	.then(result => {
		let types = [];
		result.records.forEach(function(record){
			types = types.concat(record.get('label'));
		})
		fn(types);
	}, function(error) {
		neo4jError(error, session, "getTypeLabels");
	});
}

function neo4jError(error, session, funcName){
	session.close();
	console.log(`Error reported from ${funcName}() in neo4jQueries.js`);
	vex.dialog.alert({message: error.message,
					className: 'vex-theme-wireframe'});
}

const neo4jQueries ={
	neo4jLogin,
	file_read_query,
	cmd_query,
	get_neighbours_id,
	get_neighbours_id_batch,
	successors_query,
	get_detail_id,
	get_nodes,
	getTypeLabels,
}

export default neo4jQueries;