import graphing from './graphing.js';

$(window).resize(function() {
  // The height of the #content area (in ems) should be the height of the
  // window minus that of the navbar, minus some margin and padding.
  var fontSize = parseFloat($("html").css("font-size"));
  var height = ($(this).height() - $("nav.navbar").height()) / fontSize - 13;

  $("#machine-view").height(fontSize * height);
}).resize();

// TODO: put this before the above and properly fix the race condition
let view = graphing.create(document.getElementById('machine-view'));

$.getJSON('machines', function(result) {
  for (let machine of result.nodes) {
    view.add_node(machine);
  }

  for (let e of result.edges) {
    let edge = {
      classes: e.type,
      data: e,
    };

    view.add(edge);
  }

  view.layout({
    name: 'cose-bilkent',
    animate: false,
    fit: true,
    nodeDimensionsIncludeLabels: true,
    nodeRepulsion: 10000000,
  });

  view.$('node').on('tap', function(ev) {
    const node = this.data();

    if (node.external) {
      $(location).attr('href', `worksheet?inspect=${node.id}`);
    } else {
      $(location).attr('href', `worksheet?host=${node.uuid}`);
    }
  });
});
