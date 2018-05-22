import GoldenLayout from 'golden-layout'

import 'golden-layout/src/css/goldenlayout-base.css'

//var typeOptions = '';
var nodeSearchsheetHtml = `<div class="sheet box" id="NodeSearchsheet">
								<div class="row header formBox" id="formBox">
									<label for="filterNodeType">&nbsp;Type</label>
									<div>
										&nbsp;<select id="filterNodeType" class="textBox">
											<option>process</option>
											<option>machine</option>
					 						<option>connection</option>
											<option>file-version</option>
											<option>pipe-endpoint</option>
											<option>process-meta</option>
											<option>socket-version</option>
											<option>global-only</option>
											<option>edit-session</option>
											<option>annotation</option>
					 					</select>
									</div>
									<label for="filterName">&nbsp;Name</label>
									<div>
										&nbsp;<input id="filterName" size="18.5" class="textBox leftPadding"/>
									</div><br>
									<button class="formBoxAccordion NodeSearchsheetAccordion">Machine options</button>
									<div class="hide">
										<label for="filterHost">&nbsp;Host</label>
										<div>
											&nbsp;<input id="filterHost" size="18.5" class="textBox leftPadding"/>
										</div>
										<label for="filterTuple">&nbsp;TCP</label>
										<div id="filterTuple">
											&nbsp;<input id="filterLocalIp" size="10" class="textBox leftPadding"/>
											<input id="filterLocalPort" size="3" class="textBox leftPadding"/>&nbsp;&nbsp;L<br/>
											&nbsp;<input id="filterRemoteIp" size="10" class="textBox leftPadding"/>
											<input id="filterRemotePort" size="3" class="textBox leftPadding"/>&nbsp;&nbsp;R
										</div>
									</div><br>
									<button class="formBoxAccordion NodeSearchsheetAccordion">Connected file options</button>
									<div class="hide">
										<label for="filterfileNameStart">&nbsp;Connected file name:</label><br>
										&nbsp;<input id="filterfileNameStart" size="18.5" class="textBox leftPadding"/><br>
										<label for="filterfileNum">&nbsp;More files then:</label><br>
										&nbsp;<input id="filterfileNum" size="18.5" class="textBox leftPadding"/>
									</div><br>
									<button class="formBoxAccordion NodeSearchsheetAccordion">Date options</button>
									<div class="hide">
										<label for="filterstartDate">&nbsp;Start date:</label><br>
										<input type="datetime-local" id="filterstartDate" size="3" class="textBox leftPadding"/><br>
										<label for="filterendDate">&nbsp;End date:</label><br>
										<input type="datetime-local" id="filterendDate" size="3" class="textBox leftPadding"/><br>
									</div><br>
									<button class="formBoxAccordion NodeSearchsheetAccordion">Confidence slider options</button>
									<div class="hide">
										<input type="range" min="0" max="100" value="0" class="slider" id="confidenceSliderSearch">
										<input type="text" class="textBox leftPadding" id="confidenceValueSearch" value="0">
									</div><br>
								</div>
								<div class="row content scrollable">
									<table class="table">
										<tbody id="nodelist"></tbody>
									</table>
								</div>
							</div>`;

var inspectorHtml = `<div class="sheet" id="inspectorGraph"></div>
					<div class="topOptions" id="inspectorHeader">
						<button type="button" class="headerButton" id="inspectLast">🡐</button>
						<button type="button" class="headerButton" id="inspectForward">🡒</button>
						<input type="range" min="0" max="100" value="0" class="slider" id="confidenceSliderInspector">
						<input type="text" class="WorksheetTextBox leftPadding" id="confidenceValueInspector" value="0">
					</div>
					<div class="bottomOptions">
						<input type="checkbox" id="inspectFiles" class="textBox">Files</input>
						<input type="checkbox" id="inspectSockets" class="textBox">Sockets</input>
						<input type="checkbox" id="inspectPipes" class="textBox">Pipes</input>
						<input type="checkbox" id="inspectProcessMeta" class="textBox">ProcessMetaData</input>
					</div>`;

var DetailsHtml = `<div class="sheet scrollable">
						<table id="inspector-detail" class="table"></table>
					</div>`;

var NeighboursHtml = `<div class="sheet scrollable">
						<table id="neighbour-detail" class="table"></table>
					</div>`;

var worksheetCount = 0;

var config = {
	content: [{
		type: 'row',
		content: [
			{
				type:'component',
				componentName: 'NodeSearchsheet',
				componentState: { text: nodeSearchsheetHtml },
				width: 20,
			},
			{
				type: 'component',
				componentName: `Worksheet`,
				componentState: { text: getWorksheetHtml() },
			},
			{
				type: 'stack',
				content: [
					{
					type:'component',
					componentName: 'Inspector',
					componentState: { text: inspectorHtml },
					},
					{
					type:'component',
					componentName: 'Details',
					componentState: { text: DetailsHtml },
					},
					{
					type:'component',
					componentName: 'Neighbours',
					componentState: { text: NeighboursHtml },
					}
				]
			}
		]
	}]
};

function getWorksheetHtml(){
	let index = worksheetCount;//<button type="button" class="headerButton" id="saveAnnotation${index}">Delete db Annotation Notes</button>
	return `<div class="sheet" id="worksheet${index}">
				<div class="sheet" id="worksheetGraph${index}"></div>
				<div class="topOptions">
					<button class="formBoxAccordion worksheetAccordion${index}">Annotation options</button>
					<div class="hide"><br>
						<button type="button" class="headerButton" id="addAnnotation${index}">Add Annotation Node</button>
						<button type="button" class="headerButton" id="acAnnotation${index}">Add Annotation/Connect to All Nodes</button>
					</div><br>
					<button class="formBoxAccordion worksheetAccordion${index}">Confidence slider options</button>
					<div class="hide">
						<input type="range" min="0" max="100" value="0" class="slider" id="confidenceSlider${index}">
						<input type="text" class="WorksheetTextBox leftPadding" id="confidenceValue${index}" value="0">
					</div>
				</div>
				<div class="bottomOptions">
					<input id="loadGraph${index}" name="file" type="file" style="display: none">
					<button class="headerButton" onclick="document.getElementById('loadGraph${index}').click();">Load</button>
					<button type="button" class="headerButton" id="saveGraph${index}">Save</button>
					<input id="saveFilename${index}" class="WorksheetTextBox leftPadding" name="saveFilename" type="text" placeholder="File name""></input>
					<button type="button" class="headerButton" id="reDagre${index}">Dagre</button>
					<button type="button" class="headerButton" id="reCose-Bilkent${index}">Cose</button>
				</div>
			</div>`;
}

export function intiGoldenLayoutHTML(){
	return new GoldenLayout( config, document.getElementById('worksheetPage') );
}

export function incrementWorksheetCount(){
	worksheetCount++;
}

export function getWorksheetCount(){
	return worksheetCount;
}

export function addWorksheet(goldenlayout, fn){
	goldenlayout.root.contentItems[ 0 ].addChild( {
		type: 'component',
		componentName: `Worksheet`,
		componentState: { text: getWorksheetHtml() }
	} );
	goldenlayout.emit(`WorksheetContainerCreated`, fn);
}

export function addNodeSearchsheet(goldenlayout, fn){
	goldenlayout.root.contentItems[ 0 ].addChild( {
		type: 'component',
		componentName: `NodeSearchsheet`,
		componentState: { text: nodeSearchsheetHtml },
		width: 20,
	} );
	goldenlayout.emit(`NodeSearchsheetContainerCreated`, fn);
}

// export function setTypeOptions(types){
// 	types.forEach(function(type){
// 		switch(type){
// 			case('Conn'):
// 				typeOptions = `<option>connection</option>`;
// 			break;
// 			case("File"):
// 				typeOptions = `<option>file-version</option>`;
// 			break;
// 			case("Pipe"):
// 				typeOptions = `<option>pipe-endpoint</option>`;
// 			break;
// 			case("Process"):
// 				typeOptions = `<option>process</option>`;
// 			break;
// 			case('Meta'):
// 				typeOptions = `<option>process-meta</option>`;
// 			break;
// 			case("Socket"):
// 				typeOptions = `<option>socket-version</option>`;
// 			break;
// 			case('Machine'):
// 				typeOptions = `<option>machine</option>`;
// 			break;
// 			case('Global'):
// 				typeOptions = `<option>global-only</option>`;
// 			break;
// 		}
// 	})
// }

const goldenLayoutHTML = {
	intiGoldenLayoutHTML,
	incrementWorksheetCount,
	getWorksheetCount,
	addWorksheet,
	addNodeSearchsheet,
	//setTypeOptions,
}

export default goldenLayoutHTML;
