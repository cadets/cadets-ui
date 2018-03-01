export function parseNeo4jNode(o){
	var data = {'id': o['identity']['low']};
	var labels = o['labels'];
	if (labels.indexOf('Socket') > -1){
		data.type = "socket-version";
		data = concatDictionary( data, o['properties']);
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
	 else{
		data.type = "file-version";
		data = concatDictionary( data, o['properties']);
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
	var unique = o['uuid'] ? o['uuid'] : data['id'];
	data['hash'] = unique
	// data['hash'] = short_hash(unique);
	return data;
}

export function parseNeo4jEdge(o){
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

	return {'source': src,
				'target': dst,
				'id': id,
				'type': type_map[o['type']],
				'state': state};
}

function concatDictionary(a, b){
	return Object.assign({}, a, b);
}

const neo4jParser ={
	parseNeo4jNode,
	parseNeo4jEdge,
}

export default neo4jParser;