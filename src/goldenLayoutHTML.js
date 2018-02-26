import GoldenLayout from './../node_modules/golden-layout/dist/goldenlayout.min.js';

import './../node_modules/golden-layout/src/css/goldenlayout-base.css';
import './../node_modules/golden-layout/src/css/goldenlayout-dark-theme.css';

var analysisWorksheetHtml = `<div class="sheet box" id="analysisWorksheet">
								<div class="row header formBox">
									<label for="filterNodeType">&nbsp;Type</label>
									<div>
										&nbsp;<select id="filterNodeType">
										<option></option>
											<option>connection</option>
											<option>file-version</option>
											<option>pipe-endpoint</option>
											<option>process</option>
											<option>process-meta</option>
											<option>socket-version</option>
											<option>machine</option>
										</select>
									</div>
									<label for="filterName">&nbsp;Name</label>
									<div>
										&nbsp;<input id="filterName"/>
									</div>
									<label for="filterHost">&nbsp;Host</label>
									<div>
										&nbsp;<input id="filterHost"/>
									</div>
									<label for="filterTuple">&nbsp;TCP</label>
									<div id="filterTuple">
										&nbsp;<input id="filterLocalIp" size="10"/>
										<input id="filterLocalPort" size="3"/>&nbsp;L<br/>
										&nbsp;<input id="filterRemoteIp" size="10"/>
										<input id="filterRemotePort" size="3"/>&nbsp;R
									</div>
								</div>
								<div class="row content scrollable">
									<table class="table">
										<tbody id="nodelist"></tbody>
									</table>
								</div>
							</div>`;

var inspectorHtml = `<div class="sheet" id="inspectorGraph"></div>
					<div class="bottomOptions">
						<input type="checkbox" id="inspectFiles">Files</input>
						<input type="checkbox" id="inspectSockets">Sockets</input>
						<input type="checkbox" id="inspectPipes">Pipes</input>
						<input type="checkbox" id="inspectProcessMeta">ProcessMetaData</input>
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
				componentState: { text: analysisWorksheetHtml },
				showPopoutIcon: false
			},
			{
				type: 'component',
				componentName: `Worksheet`,
				componentState: { text: getWorksheetHtml() }
			},
			{
				type: 'stack',
				content: [
					{
					type:'component',
					componentName: 'Inspector',
					componentState: { text: inspectorHtml }
					},
					{
					type:'component',
					componentName: 'Details',
					componentState: { text: DetailsHtml }
					},
					{
					type:'component',
					componentName: 'Neighbours',
					componentState: { text: NeighboursHtml }
					}
				]
			}
		]
	}]
};

function getWorksheetHtml(){
	let index = worksheetCount;
	return `<div class="sheet" id="worksheet${index}">
				<div class="sheet" id="worksheetGraph${index}"></div>
				<div class="bottomOptions">
					<input id="loadGraph${index}" name="file" type="file" style="display: none">
					<button class="bodyButton" onclick="document.getElementById('loadGraph${index}').click();">Load</button>
					<button type="button" class="bodyButton" id="saveGraph${index}">Save</button>
					<input id="saveFilename${index}" name="saveFilename" type="text" placeholder="File name""></input>
					<button type="button" class="bodyButton" id="reDagre${index}">Dagre</button>
					<button type="button" class="bodyButton" id="reCose-Bilkent${index}">Cose</button>
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
	//console.log(goldenlayout.root.contentItems[ 0 ]);
	goldenlayout.emit(`WorksheetContainerCreated`, fn);
}

const goldenLayoutHTML = {
	intiGoldenLayoutHTML,
	incrementWorksheetCount,
	getWorksheetCount,
	addWorksheet,
}

export default goldenLayoutHTML;