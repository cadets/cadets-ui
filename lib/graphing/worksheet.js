import graphing from './graphing.js';
import wurl from 'wurl';

require('./worksheet.styl');


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
    accesskey: "s",
    action: inspect_node,
  },
  "add-neighbours": {
    name: "Import neighbours",
    icon: "fa-plus",
    accesskey: "n",
    action: import_neighbours_into_worksheet,
  },
  "expand_forward": {
      name: "Import successors",
      icon: "fa-plus-circle",
      accesskey: "s",
      action: successors,
  },
  "add-remove-sep": "---",
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
  "remove-mark-sep": "---",
  "mark": {
    name: "Highlight",
    icon: "fa-thumb-tack",
    accesskey: "h",
    action: toggle_node_importance,
  },
  "mark-other-sep": "---",
  "commands": {
    name: "Commands",
    icon: "fa-terminal",
    accesskey: "c",
    action: function(id) {
      $.getJSON(`cmds/${id}`, function(result) {
        let message = `<h2>Commands run by node ${id}:</h2>`;

        if (result.cmds.length == 0) {
          message += '<p>none</p>';
        } else {
          message += '<ul>';
          for (let command of result.cmds) {
            console.log(command);
            message += `<li><a onclick="command_clicked(${command.dbid})">${command.cmd}</a></li>`;
          }
          message += '</ul>';
        }

        vex.dialog.alert({ unsafeMessage: message });
      });
    },
  },
  "files_read": {
    name: "Files read",
    icon: "fa-search",
    accesskey: "r",
    action: function(id) {
      $.getJSON(`files_read/${id}`, function(result) {
        let str = '';
        Array.from(result.names).forEach(function(name) {
          str += `<li>${name}</li>`;  // XXX: requires trusted UI server!
        });

        vex.dialog.alert({
          unsafeMessage: `<h2>Files read:</h2><ul>${str}</ul>`,
        });
      });
    },
  },
};

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
function get_neighbours(id, fn, err = console.log) {
  const query =
    `files=${$('#inspectFiles').is(':checked')}` +
    `&sockets=${$('#inspectSockets').is(':checked')}` +
    `&pipes=${$('#inspectPipes').is(':checked')}` +
    `&process_meta=${$('#inspectProcessMeta').is(':checked')}`
    ;

  return $.getJSON(`neighbours/${id}?${query}`, fn).fail(err);
}

//
// Fetch successors to a node, based on some user-specified filters.
//
function get_successors(id, fn, err = console.log) {
  const query =
    `files=${$('#inspectFiles').is(':checked')}` +
    `&sockets=${$('#inspectSockets').is(':checked')}` +
    `&pipes=${$('#inspectPipes').is(':checked')}` +
    `&process_meta=${$('#inspectProcessMeta').is(':checked')}` +
    `&max_depth=100`
    ;

  return $.getJSON(`successors/${id}?${query}`, fn).fail(err);
}



//
// How to import a node into the worksheet
//
function import_into_worksheet(id, err = console.log) {
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
    }).fail(err).then(function(){
      attach_context_menu(graph, '#worksheet', worksheet_context_items);
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

  $.getJSON(`detail/${id}`, function(result) {
    for (let property in result) {
      inspector.detail.append(`
        <tr>
          <th>${property}</th>
          <td>${result[property]}</td>
        </tr>
      `)
    }
    inspectee = result
  }).fail(err).then(function() {
    // Display the node's immediate connections in the inspector "Graph" panel.
    get_neighbours(id, function(result) {
      inspector.graph.remove('node');

      add_node(inspectee, inspector.graph);

      for (let n of result.nodes) {
        add_node(n, inspector.graph);

        let meta = graphing.node_metadata(n);
        inspector.neighbours.append(`
          <tr>
            <td><a onclick="import_into_worksheet(${n.id})" style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
            <td><a onclick="import_into_worksheet(${n.id})">${meta.label}</a></td>
            </tr>
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
      if (result.edges.length < 100) {
        layout(inspector.graph, 'dagre');
      } else {
        layout(inspector.graph, 'cose');
      }

      inspector.graph.zoom({
        level: 1,
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
          accesskey: "n",
          action: import_neighbours_into_worksheet,
        },
        "inspect": {
          name: "Inspect",
          icon: "fa-search",
          accesskey: "s",
          action: inspect_node,
        },
        "import-and-inspect": {
          name: "Import and Inspect",
          icon: "fa-search-plus",
          accesskey: "a",
          action: inspect_and_import,
        }
      });
    }).fail(err);
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

function toggle_sidebar() {
  $('#sidebar').toggleClass('collapsed');
  $('#content').toggleClass('col-sm-6 col-sm-12')
               .toggleClass('col-md-8 col-md-12')
               .toggleClass('col-lg-9 col-lg-9');
  $("#inspector-graph").width($('#inspector').width());
  $("#worksheet").hide().show();
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
function update_nodelist(err = console.log) {
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

    let current_uuid = null;
    let colour = 0;

    for (let node of result) {
      let meta = graphing.node_metadata(node);

      if (node.uuid != current_uuid) {
        colour += 1;
        current_uuid = node.uuid;
      }

      nodelist.append(`
        <tr class="${rowColour(colour)}">
          <td><a onclick="inspect_node(${node.id})" style="color: black;"><i class="fa fa-${meta.icon}" aria-hidden="true"></i></a></td>
          <td>${meta.timestamp}</td>
          <td><a onclick="inspect_node(${node.id})">${meta.label}</a></td>
        </tr>`);
    }
  }).fail(err);
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


//
// Process query parameters:
//
//   nodeType=T   where T is one of {connection,file-version,machine, ...}
//   name=N       where N is a subset of a file path
//   host=H       where H is the UUID of a host
//   tcp=A:B:C:D  where A is the local IP, B is the local port,
//                C is the remote IP and D is the remote port
//                (any of which may be empty)
//
$('#filterNodeType').val(wurl('?nodeType'));
$('#filterName').val(wurl('?name'));
$('#filterHost').val(wurl('?host'));

const tcp_tuple = wurl('?tcp');
if (tcp_tuple) {
  const parts = tcp_tuple.split(':');
  if (parts.length == 4) {
    $('#filterLocalIp').val(parts[0]);
    $('#filterLocalPort').val(parts[1]);
    $('#filterRemoteIp').val(parts[2]);
    $('#filterRemotePort').val(parts[3]);
  }
}


//
// Create worksheet and inspector views.
//
var worksheet = {
  graph: graphing.create(document.getElementById('worksheet')),
};

worksheet.graph.autopanOnDrag({
  enabled: true,
  selector: 'node',
  speed: 0.25,
});

var inspector = {
  detail: $('#inspector-detail'),
  neighbours: $('#neighbour-detail'),
  graph: graphing.create(document.getElementById('inspector-graph')),
};
inspector.graph.inspectee = null;


//
// Add onchange event handlers to filter elements.
//
$('input[id *= "filter"],select[id *= "filter"]').on('change', update_nodelist);

// When the inspector filters change, re-inspect the current node.
$('input[id *= "inspect"]').on('change', function() {
  const node = inspector.graph.inspectee;
  if (node && !node.empty()) {
    inspect_node(node.id());
  }
});


//
// Resize worksheet and inspector when the window size changes.
//
// Unfortunately this seems difficult to do via CSS.
//
update_nodelist();

$(window).resize(function() {
  console.log('resized');

  // The height of the #content area (in ems) should be the height of the
  // window minus that of the navbar, minus some margin and padding.
  let fontSize = parseFloat($("html").css("font-size"));
  let height = ($(this).height() - $("nav.navbar").height()) / fontSize - 3;
  let width = $(this).width() / fontSize - 73;

  $("html").keypress(function(ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || !ev.shiftKey) {
      return;
    }

    if (ev.key == 'D') {
      layout(worksheet.graph, 'dagre');
    } else if (ev.key == 'U') {
      layout(worksheet.graph, 'cose-bilkent');
    } else if (ev.key == 'H') {
      toggle_sidebar();
    }
  });

  $("#sidebar").height(fontSize * height);
  $("#worksheet-container").height(fontSize * height);
  $("#inspector").height(fontSize * height);
  $("#inspector-graph").height(fontSize * (height - 12));
}).resize();

//
// Allow node addition to be partially automated for testing:
// if the query includes `nodes=foo,bar,baz` then the nodes
// `foo`, `bar` and `baz` will be automatically added to the worksheet.
//
const nodes_to_add = wurl('?nodes');
if (nodes_to_add) {
  let promise = $.when(null);

  for (let node of nodes_to_add.split(',')) {
    promise.then(import_into_worksheet(node));
  }
}

//
// Similarly, allow `inspect=XXXX` to load the workspace page with
// a single node pre-loaded in the inspector.
//
const node_to_inspect = wurl('?inspect');
if (node_to_inspect) {
  inspect_node(node_to_inspect);
}

// If we've explicitly specified nodes to import or inspect, close the sidebar
// (which is really about initial exploration).
if (nodes_to_add || node_to_inspect) {
  toggle_sidebar();
}
