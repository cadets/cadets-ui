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

var worksheetHtml = `<div class="sheet" id="worksheet">
						<div class="sheet" id="worksheetGraph"></div>
						<div class="bottomOptions">
							<input id="loadGraph" name="file" type="file" style="display: none">
							<button class="bodyButton" onclick="document.getElementById('loadGraph').click();">Load</button>
							<button type="button" class="bodyButton" id="saveGraph">Save</button>
							<input id="saveFilename" name="saveFilename" type="text" placeholder="File name""></input>
							<button type="button" class="bodyButton" id="reDagre">Temp</button>
							<button type="button" class="bodyButton" id="reCose-Bilkent">Cose</button>
						</div>
					</div>`;

var inspectorHtml = `<div class="sheet scrollable">
						<div class="sheet" id="inspectorGraph"></div>
						<div class="bottomOptions">
							<input type="checkbox" id="inspectFiles">Files</input>
							<input type="checkbox" id="inspectSockets">Sockets</input>
							<input type="checkbox" id="inspectPipes">Pipes</input>
							<input type="checkbox" id="inspectProcessMeta">ProcessMetaData</input>
						</div>
						<div class="inspectorT1">
							<div class="box">
								<div class="row header fillHeader">
									<font>&nbsp;Details</font>
								</div>
								<div class="row content scrollable">
									<table id="inspector-detail" class="table"></table>
								</div>
							</div>	
						</div>
						<div class="inspectorT2">
							<div class="box">
								<div class="row header fillHeader">
									<font>&nbsp;Neighbours</font>
								</div>
								<div class="row content scrollable">
									<table id="neighbour-detail" class="table"></table>
								</div>
							</div>	
						</div>
					</div>`;

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
			type:'component',
			componentName: 'Worksheet',
			componentState: { text: worksheetHtml },
			showPopoutIcon: false
		},
		{
			type:'component',
			componentName: 'Inspector',
			componentState: { text: inspectorHtml }
		}
		]
	}]
};

export var newItemConfig = {
    type: 'component',
    componentName: 'Worksheet',
    componentState: { text: "test" }
};

export function intiGoldenLayoutHTML(){
	return new GoldenLayout( config, document.getElementById('worksheetPage') );
}

const goldenLayoutHTML = {
	intiGoldenLayoutHTML,
	newItemConfig,
}

export default goldenLayoutHTML;