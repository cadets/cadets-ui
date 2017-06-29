//
// Main worksheet context menu items:
//
//   derived from jQuery.contextMenu, but with `action` values that take
//   a node ID instead of a normal callback (which we provide instead from
//   within attach_context_menu).
//
let worksheet_context_items = {
  "inspect": {
    name: "Inspect",
    icon: "fa-search",
    accesskey: "n",
    action: inspect,
  },
  "add-connected": {
    name: "Import connected nodes",
    icon: "fa-plus",
    accesskey: "c",
    action: import_connected_into_worksheet,
  },
  "expand_forward": {
      name: "Import successors",
      icon: "fa-plus-circle",
      accesskey: "s",
      action: successors,
  },
  "remove": {
    name: "Remove",
    icon: "fa-times",
    accesskey: "r",
    action: remove_from_worksheet,
  },
  "remove_connected": {
    name: "Remove connected",
    icon: "fa-times",
    accesskey: "v",
    action: remove_connected_from_worksheet,
  },
};


//
// How to add a node to a graph
//
function add_node(data, graph, renderedPosition = null) {
  // Have we already imported this node?
  if (!graph.nodes(`#${data.id}`).empty()) {
    return;
  }

  let node = {
    data: data,
    renderedPosition: renderedPosition,
  };

  node.classes = data.type;
  node.data.label = node_metadata(data).label;
  graph.add(node);
}

//
// How to add an edge to the worksheet
//
function add_edge(data, graph) {
  // Have we already imported this edge?
  if (!graph.edges(`#${data.id}`).empty()) {
    return;
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
  const query =
    `files=${$('#inspectFiles').is(':checked')}` +
    `&sockets=${$('#inspectSockets').is(':checked')}` +
    `&process_meta=${$('#inspectProcessMeta').is(':checked')}`
    ;

  return $.getJSON(`neighbours/${id}?${query}`, fn);
}

//
// Fetch successors to a node, based on some user-specified filters.
//
function get_successors(id, fn) {
  const query =
    `files=${$('#inspectFiles').is(':checked')}` +
    `&sockets=${$('#inspectSockets').is(':checked')}` +
    `&process_meta=${$('#inspectProcessMeta').is(':checked')}`
    ;

  return $.getJSON(`successors/${id}?${query}`, fn);
}



//
// How to import a node into the worksheet
//
function import_into_worksheet(id) {
  // Have we already imported this node?
  if (!worksheet.getElementById(id).empty()) {
    return $.when(null);
  }

  let position = {
    x: worksheet.width() / 2,
    y: worksheet.height() / 2,
  };

  return $.getJSON(`detail/${id}`, function(result) {
    let promise = null;

    if ('parent' in result && worksheet.nodes(`#${result.parent}`).empty()) {
      promise = import_into_worksheet(result.parent);
    } else {
      promise = $.when(null);
    }

    promise.then(function() {
      add_node(result, worksheet, position);
    }).then(function() {
      get_neighbours(id, function(result) {
        let elements = worksheet.elements();
        let node = worksheet.nodes(`[id="${id}"]`);

        for (let edge of result.edges) {
          let other = null;
          if (edge.source == id) {
            other = elements.nodes(`#${edge.target}`);
          } else if (edge.target == id) {
            other = elements.nodes(`#${edge.source}`);
          }

          if (!other.empty()) {
            add_edge(edge, worksheet);
          }
        }
      });
    }).then(function(){
      attach_context_menu(worksheet, '#worksheet', worksheet_context_items);
    });
  });
}

function import_all_from_inspector() {
  let node = inspector.graph.inspectee;
  if (node == null) {
    return;
  }

  let promise = import_into_worksheet(node.data().id);

  inspector.graph.nodes().forEach(function (node) {
    promise.then(import_into_worksheet(node.data().id));
  });
}


//
// Add all nodes connected to a particular node to the worksheet.
//
function import_connected_into_worksheet(id) {
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
function inspect(id) {
  // Display the node's details in the inspector "Details" panel.
  $.getJSON(`detail/${id}`, function(result) {
    inspector.detail.empty();
    for (let property in result) {
      inspector.detail.append(`
        <tr>
          <th>${property}</th>
          <td>${result[property]}</td>
        </tr>
      `)
    }
  });

  // Display the node's immediate connections in the inspector "Graph" panel.
  get_neighbours(id, function(result) {
    inspector.graph.remove('node');

    for (let n of result.nodes) {
      add_node(n, inspector.graph);
    }

    for (let e of result.edges) {
      add_edge(e, inspector.graph);
    }

    let n = inspector.graph.elements().nodes(`[id="${id}"]`);
    if (n.empty()) {
      n = inspector.graph.elements().nodes(`[uuid="${id}"]`);
    }
    inspector.graph.inspectee = n;

    layout(inspector.graph, 'dagre');
    inspector.graph.zoom({
      level: 1.0,
      position: inspector.graph.inspectee.position(),
    });

    // Create a context menu for the inspector graph that allows nodes to be
    // imported into the worksheet or inspected themselves.
    attach_context_menu(inspector.graph, '#inspector-graph', {
      "import": {
        name: "Import node",
        icon: "fa-upload",
        accesskey: "m",
        action: import_into_worksheet,
      },
      "add-connected": {
        name: "Import connected nodes",
        icon: "fa-plus",
        accesskey: "c",
        action: import_connected_into_worksheet,
      },
      "inspect": {
        name: "Inspect",
        icon: "fa-search",
        accesskey: "n",
        action: inspect,
      }
    });
  });
}


//
// Define what it means to show "successors" to a node.
//
function successors(id) {
  // Display the node's details in the inspector "Details" panel.
  get_successors(id, function(result) {

    let position = {
      x: worksheet.width() / 2,
      y: worksheet.height() / 2,
    };

    for (let n of result.nodes) {
      add_node(n, worksheet, position);
    }

    let elements = worksheet.elements();
    for (let e of result.edges) {
      add_edge(e, worksheet);
    }

    attach_context_menu(worksheet, '#worksheet', worksheet_context_items);
  });
};


function remove_from_worksheet(id) {
  worksheet.remove(`node#${id}`);
}

function remove_connected_from_worksheet(id) {
  worksheet.nodes(`#${id}`).connectedEdges().connectedNodes().remove();
}


//
// Populate node list.
//
function update_nodelist() {
  let query = {
    node_type: $('#filterNodeType').val(),
    name: $('#filterName').val(),
    host: $('#filterHost').val(),
    local_ip: $('#filterLocalIp').val(),
    local_port: $('#filterLocalPort').val(),
    remote_ip: $('#filterRemoteIp').val(),
    remote_port: $('#filterRemotePort').val(),
  };


  $.getJSON('nodes', query, function(result) {
    let nodelist = $('#nodelist');
    nodelist.empty();

    for (let node of result) {
      meta = node_metadata(node);

      nodelist.append(`
        <tr>
          <td><i class="fa fa-${meta.icon}" aria-hidden="true"></i></td>
          <td><a onclick="inspect(${node.id})">${meta.label}</a></td>
        </tr>`);
    }
  });
}
