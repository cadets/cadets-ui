//
// Add a node to a graph.
//
function add_node(data, graph, renderedPosition = null) {
  // Have we already imported this node?
  if (!graph.nodes(`[id="${data.id}"]`).empty()) {
    return;
  }

  // When importing file versions, draw a compound node with the filenames
  // to show the abstraction and to simplify the versions.
  if (data.type == 'file-version' && data.uuid) {
    let file = graph.nodes(`[id="${data.uuid}"]`);

    if (file.empty()) {
      add_node({
        id: data.uuid,
        type: 'file',
        names: new Set(data.names),
        'parent': data['parent'],
      }, graph, renderedPosition);
    } else {
      let existing = file.data();
      existing.names = new Set([...existing.names, ...data.names]);
      existing.label = Array.from(existing.names).join(' ');
    }

    data['parent'] = data.uuid;
  }

  let node = {
    data: data,
    renderedPosition: renderedPosition,
  };

  node.classes = data.type;
  if (data.external) {
    node.classes += ' external';
  }

  node.data.label = node_metadata(data).label;

  graph.add(node);
}

//
// Load a Cytograph JSON representation into an object with a 'graph' property.
//
function load(file, graphContainer) {
  let reader = new FileReader();
  reader.addEventListener('loadend', function() {
    let data = JSON.parse(reader.result);
    data.container = graphContainer.graph.container();
    data.layout = { name: 'preset' };
    graphContainer.graph = cytoscape(data);
  });

  reader.readAsText(file);
}

//
// Load a Cytograph CSS file and apply it to a graph.
//
// Unfortunately this is hard to do statically.
//
function load_graph_style(graphs) {
  $.ajax('static/style/cytoscape.css', {
    dataType: 'text',
    mimeType: 'text/css',
    success: function(result) {
      for (let g of graphs) {
        g.style(result);
      }
    }
  });
}

//
// Apply a named graph layout algorithm to a graph.
//
function layout(graph, algorithm) {
  graph.layout({
    name: algorithm,
    rankDir: 'LR',
    animate: false,
  })
  .run();
};

//
// Create a context menu and attach it to all nodes in a graph.
//
// To position everything properly, this requires that the graph be contained
// within a DOM element with non-static positioning (i.e., relative, fixed or
// absolute positioning).
//
function attach_context_menu(graph, selector, items) {
  $.contextMenu({
    selector: selector,
    trigger: 'none',
    items: items,
    callback: function(action, options) {
      let node = graph.contextMenuNode.data();

      for (let key in items) {
        if (action == key) {
          items[key].action(node.id);
        }
      }

      graph.contextMenuNode.unselect();
      graph.contextMenuNode = null;
    }
  });

  graph.$('node').on('tap', function(ev) {
    if (ev.target != this) {
      return;
    }

    // The node currently showing a context menu. These menus are madal and
    // therefore provide implicit synchronization.
    graph.contextMenuNode = this;

    let pos = ev.renderedPosition;
    let offset = $(selector).offset();
    pos.x += offset.left;
    pos.y += offset.top;

    $(selector).contextMenu(pos);
  });
}

//
// Extract graphical metadata about a graph node (icon and label) that isn't
// really appropriate to serve from OPUS/Neo4j.
//
function node_metadata(node) {
  let metadata = null;
  let timestamp = null;

  switch (node.type) {
    case 'connection':
      metadata = {
        icon: 'connectdevelop',
        label: node.endpoints.join(' '),
      };
      break;

    case 'machine':
      metadata = {
        icon: 'desktop',
        label: node.names.join(' / '),
      };
      timestamp = node.first_seen;
      if (metadata.label == '') {
          metadata.label = node.ips.join(' / ');
      }
      break;

    case 'pipe-endpoint':
      metadata = {
        icon: 'share',
      };
      timestamp = node.creation;
      break;

    case 'process':
      metadata = {
        icon: 'terminal',
        label: node.cmdline,
      };
      timestamp = node.last_update;
      break;

    case 'file':
      metadata = {
        icon: 'file-o',
        label: Array.from(node.names).join(' '),
      };
      break;

    case 'file-version':
      metadata = {
        icon: 'file-o',
        label: node.names.join(' / '),
      };
      timestamp = node.creation;
      break;

    case 'process-meta':
      metadata = {
        icon: 'terminal',
        label: 'metadata change',
      };
      timestamp = node.meta_ts;
      break;

    case 'socket-version':
      metadata = {
        icon: 'plug',
        label: node.names.join(' / '),
      };
      timestamp = node.creation;
      break;

  default:
    console.log('unknown node type: ' + node.type);
    console.log(node);
    return {
      icon: 'question',
      label: 'unknown',
    };
  }

  if (timestamp) {
    metadata.timestamp =
      moment.unix(timestamp / 1000000000).format('HH:mm[h] D MMM');
  } else {
    metadata.timestamp = '';
  }

  if (metadata.label == '') {
    metadata.label = '???';
  }

  return metadata;
}

//
// Save the current graph in a JSON format.
//
function save(graph) {
  let blob = new Blob([ JSON.stringify(graph.json()) ], { type: 'text/json' });

  let a = document.createElement('a');

  a.download = 'worksheet.json';
  a.href= window.URL.createObjectURL(blob);
  a.style.display = 'none';

  document.body.appendChild(a);

  a.click();
}
