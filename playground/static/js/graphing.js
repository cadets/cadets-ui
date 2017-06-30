//
// Add a node to a graph.
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
  if (data.external) {
    node.classes += ' external';
  }

  node.data.label = node_metadata(data).label;

  graph.add(node);
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
  switch (node.type) {
    case 'connection':
      return {
        icon: 'connectdevelop',
        label: node.client_ip + ':' + node.client_port + '\n' +
               node.server_ip + ':' + node.server_port,
      };

    case 'machine':
      return {
        icon: 'desktop',
        label: node.names.join(' / '),
      };

    case 'process':
      return {
        icon: 'terminal',
        label: node.cmdline,
      };

    case 'file-version':
      return {
        icon: 'file-o',
        label: node.names.join(' / '),
      };

    case 'process-meta':
      return {
        icon: 'terminal',
        label: 'metadata change',
      };

    case 'socket-version':
      return {
        icon: 'plug',
        label: node.names.join(' / '),
      };

  default:
    console.log('unknown node type: ' + node.type);
    console.log(node);
    return {
      icon: 'question',
      label: 'unknown',
    };
  }
}
