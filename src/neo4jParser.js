var pvm_version = null;

export function parseNeo4jNode(o){
	let data = {'id': o['identity']['low']};
	let labels = o['labels'];
	if (labels.indexOf('Socket') > -1){
		data.type = "socket-version";
		data = concatDictionary( data, o['properties']);
		switch(pvm_version){
			case(2):
				data.name = data.ip;
				break;
		}
	}
	else if (labels.indexOf('Pipe') > -1){
		data.type = "pipe-endpoint";
		data = concatDictionary( data, o['properties']);
	}
	else if (labels.indexOf('Process') > -1){
		data.type = "process";
		data = concatDictionary( data, o['properties']);
	}
	else if (labels.indexOf('Machine') > -1){
		data.type = "machine";
		data = concatDictionary( data, o['properties']);
	} 
	else if (labels.indexOf('Meta') > -1){
		data.type = "process-meta";
		data = concatDictionary( data, o['properties']);
	}
	else if (labels.indexOf('Conn') > -1){
		data = concatDictionary( data, o['properties']);
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
			// var hashids = new Hashids();//ask about short_hash
			// console.log(data['wrpipe']);
			// console.log(hashids.encode(data['wrpipe']));
			// var wrpipe = hashids.encode(data['wrpipe']);
			// var rdpipe = hashids.encode(data['rdpipe']);
			data['endpoints'] = ['wrpipe: ' + data['wrpipe'],
								'rdpipe: ' + data['rdpipe']];
		}
		data.type= "connection";
	}
	 else if (labels.indexOf('File') > -1){
		data.type = "file-version";
		data = concatDictionary( data, o['properties']);
	}
	else if (labels.indexOf('EditSession') > -1){
		data.type = "edit-session";
		data = concatDictionary( data, o['properties']);
	}
	 else if (labels.indexOf('Global') > -1){
		data.type = "global";
		data = concatDictionary( data, o['properties']);
	}
	else{
		console.log(`neo4jParser.js - parseNeo4jNode func does not recognize label ${labels}`);
	}
	// mchs.forEach(function(mch){
	// //for(mch in mchs){
	// 	//console.log(`${data['host']} == ${mch.id}`);
	// 	if (data['host'] != null && data['host'] == mch.id){//'host' in o and o['host'] in self.machines{
	// 		data.parent = mch.id;
	// 		data.hostname = mch.name;
	// 		//data.update({'hostname': name, 'parent': i});
	// 	}
	// });
	// // Calculate a short, easily-compared hash of something unique
	// // (database ID if we don't have a UUID)
	data['hash'] = o['uuid'] ? o['uuid'] : data['id'];
	// data['hash'] = short_hash(unique);
	return data;
}

export function parseNeo4jEdge(o){
	let id = -o['identity']['low'];				// This is negitive because it was sometimes conflicting 
	let type_map = {'PROC_PARENT': 'parent',	// with a node's id which must be unique
					'PROC_OBJ': 'io',
					'META_PREV': 'proc-metadata',
					'PROC_OBJ_PREV': 'proc-change',
					'GLOB_OBJ_PREV': 'file-change',
					'COMM': 'comm',
					'comm': 'comm',
					'INF': 'inf'};
	let state;
	let src;
	let dst;
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
		src = o['start']['low'];
		dst = o['end']['low'];
	}
	if (o['type'] == 'COMM'){
		src = o['start']['low'];
		dst = o['end']['low'];
	}
	else{
		src = o['end']['low'];
		dst = o['start']['low'];
	}
	let type = "";
	if(type_map[o['type']] == null){
		console.log(`neo4jParser.js - parseNeo4jEdge edge type is not recognizd type: ${o['type']}`);
	}
	else{
		type = type_map[o['type']];
	}
	return {'source': src,
				'target': dst,
				'id': id,
				'type': type,
				'state': state};
}

function concatDictionary(a, b){
	return Object.assign({}, a, b);
}

export function setPVMv(PVMV){
	pvm_version = PVMV.low;
}

const neo4jParser ={
	parseNeo4jNode,
	parseNeo4jEdge,
	setPVMv,
}

export default neo4jParser;