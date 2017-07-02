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
  "add-neighbours": {
    name: "Import neighbours",
    icon: "fa-plus",
    accesskey: "c",
    action: import_neighbours_into_worksheet,
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
  "remove_neighbours": {
    name: "Remove neighbours",
    icon: "fa-times",
    accesskey: "v",
    action: remove_neighbours_from_worksheet,
  },
  "mark": {
    name: "Toggle Highlighting",
    icon: "fa-thumb-tack",
    accesskey: "h",
    action: toggle_node_importance,
  },
};


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
  let graph = worksheet.graph;

  // Have we already imported this node?
  if (!graph.getElementById(id).empty()) {
    return $.when(null);
  }

  let position = {
    x: graph.width() / 2,
    y: graph.height() / 2,
  };

  return $.getJSON(`detail/${id}`, function(result) {
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
    }).then(function(){
      attach_context_menu(graph, '#worksheet', worksheet_context_items);
    });
  });
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
      "add-neighbours": {
        name: "Import neighbours",
        icon: "fa-plus",
        accesskey: "c",
        action: import_neighbours_into_worksheet,
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
  let graph = worksheet.graph;

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

    attach_context_menu(graph, '#worksheet', worksheet_context_items);
  });
};


function toggle_node_importance(id) {
  nodes = worksheet.graph.nodes(`node#${id}`);
  nodes.forEach( function(ele){
      if (ele.hasClass('important')) {
        ele.removeClass('important');
      } else {
        ele.addClass('important');
      }
  });
}

function remove_from_worksheet(id) {
  worksheet.graph.remove(`node#${id}`);
}

function remove_neighbours_from_worksheet(id) {
  let node = worksheet.graph.$id(id);

  // First check to see if this is a compound node.
  let children = node.children();
  if (!children.empty()) {
    children.forEach(function (node) { worksheet.graph.remove(node); });
    node.remove();
    return;
  }

  // Otherwise, remove edge-connected neighbours that aren't highlighted.
  node.connectedEdges().connectedNodes().filter(function(ele) {
    return !ele.hasClass('important');
  }).remove();
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
          <td><a onclick="inspect(${node.id})" style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
          <td><a onclick="inspect(${node.id})">${meta.label}</a></td>
        </tr>`);
    }
  });
}
