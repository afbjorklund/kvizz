var width = window.innerWidth;  // width and height of the SVG canvas
var height = window.innerHeight;
// A list of node objects.  We represent each node as {id: "name"}, but the D3
// system will decorate the node with addtional fields, notably x: and y: for
// the force layout and index" as part of the binding mechanism.
var nodes = [];
// A list of links.  We represent a link as {source: <node>, target: <node>},
// and in fact, the force layout mechanism expects those names.
var links = [];
// Create the force layout.  After a call to force.start(), the tick method will
// be called repeatedly until the layout "gels" in a stable configuration.
var force = d3.layout.force()
    .nodes(nodes)
    .links(links)
    .linkDistance(80)
    .charge(-800)
    .on("tick", tick);

// add an SVG element inside the DOM's BODY element
var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.behavior.zoom().on("zoom", function () {
	svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
    }))
    .append("g")

resize();
d3.select(window).on("resize", resize);

function resize() {
    width = window.innerWidth, height = window.innerHeight;
    svg.attr("width", width).attr("height", height);
    force.size([width, height]).resume();
}

function update_graph() {
    // Per-type markers, as they don't inherit styles.
    svg.append("defs").selectAll("marker")
        .data(["runningon", "serviceinstance", "supporting"])
        .enter().append("marker")
        .attr("id", function(d) {
            return d;
        })
        // .attr("viewBox", "-5 -5 10 10") //"0 -5 10 10")
        .attr("refX", function(d) {
            if (d === 'serviceinstance') {
                return 28;
            }
            return 48;
        })              // 28 or 48
        .attr("refY", 0) //-3)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0,0 m -5,-5 L 5,0 L -5,5 Z");    // M0,-5L10,0L0,5

    // First update the links...
    var link_update = svg.selectAll(".link").data(
        force.links(),
        function(d) {
            // console.log("Link update: " + JSON.stringify(d));
            return d.source.id + "-" + d.target.id;
        }
    );

    // link_update.enter() creates an SVG line element for each new link
    // object.
    link_update.enter()
        .append("line", ".node") // With insert instead of append, things go south...
        .attr("class", function(d) {
            return "link " + d.target.linktype;
        })
        .attr("marker-end", function(d) {
            return "url(#" + d.target.linktype + ")";
        });

    // link_update.exit() processes link objects that have been removed
    // by removing its corresponding SVG line element.
    link_update.exit()
        .remove();

    // Now update the nodes.
    var node_update = svg.selectAll(".node").data(
        force.nodes(),
        function(d) {
            return d.id;
        }
    );

    // Create an SVG circle for each new node added to the graph.
    var g = node_update.enter().append("g");
    g.append("circle")
        .attr("id", function(d) {
            return d.id;
        })
        .attr("class", function(d) {
            return 'node ' + d.nodetype + ' ' + (d.namespace || d.state);
        })
        .attr("r", function(d) {
            return sizeFromType(d)
        })
        .call(force.drag)
        .on("click", click);
    g.append("text")
        .attr("x", 8)
        .attr("y", "1em")  // 31em
        .text(function(d) {
            return d.name;
        });

    // Remove the SVG circle whenever a node vanishes from the node list.
    node_update.exit().remove();

    // Start calling the tick() method repeatedly to lay out the graph.
    force.start();
}

function sizeFromType(d) {
    if (typeof d.nodetype === 'undefined') {
        return 10;
    }
    switch (d.nodetype) {
    case 'node':
        return 40;
    case 'pod':
        return 20;
    case 'container':
        return 10;
    }
}

function click(node) {
    console.log("Clicked: " + JSON.stringify(node));
}


// This tick method is called repeatedly until the layout stabilizes.
//
// NOTE: the order in which we update nodes and links does NOT determine which
// gets drawn first -- the drawing order is determined by the ordering in the
// DOM.  See the notes under link_update.enter() above for one technique for
// setting the ordering in the DOM.
function tick() {
    // Drawing the nodes: Update the cx, cy attributes of each circle element
    // from the x, y fields of the corresponding node object.
    svg.selectAll(".node")
        .attr("cx", function(d) {
            return d.x;
        })
        .attr("cy", function(d) {
            return d.y;
        });
    // Drawing the links: Update the start and end points of each line element
    // from the x, y fields of the corresponding source and target node objects.
    svg.selectAll(".link")

    // TODO we should calculate a shorter path to target so we can truncate when stuff starts to render on top.
        .attr("x1", function(d) {
            return d.source.x;
        })
        .attr("y1", function(d) {
            return d.source.y;
        })
        .attr("x2", function(d) {
            return d.target.x;
        })
        .attr("y2", function(d) {
            return d.target.y;
        });

    svg.selectAll("text")
        .attr("x", function(d) {
            return d.x;
        })
        .attr("y", function(d) {
            return d.y;
        })
}

// ================================================================


function loadData() {
    var kubeNodes = [];
    var pods = [];
    var containers = [];

    $.getJSON("/api/v1/nodes", null, function(data) {
        var map = {};
        // START kube nodes
        $.each(data.items, function(index, item) {
            map[item.metadata.name] = item.metadata.uid;
            kubeNodes.push({"id": item.metadata.uid, "name": item.metadata.name, "status": "ready", linktype: 'supporting', nodetype: 'node'});
        });

        // START pods
        $.getJSON("/api/v1/pods", null, function(data) {

            $.each(data.items, function(index, item) {
                pods.push({"id": item.metadata.uid, "name": item.metadata.name, "status": item.status.phase, "node": item.spec.nodeName, "namespace": item.metadata.namespace})
                var podId = item.metadata.uid;
                var nodeId = map[item.spec.nodeName];

                // START containers
                $.each(item.status.containerStatuses, function(index, item) {
                    state = 'unknown';
                    if (item.state.waiting)
                        state = 'waiting';
                    else if (item.state.running)
                        state = 'running';
                    else if (item.state.terminated)
                        state = 'terminated';

                    containers.push({
                        "id": item.containerID,
                        "name": item.name,
                        "image": item.image,
                        "podId": podId,
                        "nodeId": nodeId,
                        "status": state
                    })
                });
            });
            buildLinks(kubeNodes, pods, containers);
        });
    });


    function buildLinks(kubeNodes, pods, containers) {
        var links = [];

        for (var b = 0; b < kubeNodes.length; b++) {

            var kubeNode = kubeNodes[b];
            kubeNodeHasContainers = false;

            for (var a = 0; a < pods.length; a++) {
                var pod = pods[a];
                var containerAdded = false;
                for (var i = 0; i < containers.length; i++) {
                    var container = containers[i];

                    // If container not present on node, skip
                    if (container.nodeId !== kubeNode.id) {
                        continue;
                    }

                    if (container.podId == pod.id) {
                        var link = {
                            source: {
                                id: container.id,
                                name: container.name,
                                linktype: "serviceinstance",
                                status: container.status,
                                nodeId: container.nodeId
                            },
                            target: {
                                id: pod.id + '-' + container.nodeId,
                                name: pod.name,
                                linktype: "serviceinstance",
                                status: pod.status,
                                namespace: pod.namespace,
                                nodeId: container.nodeId
                            },
                            src: 'container',
                            tgt: 'pod'
                        };
                        links.push(link);
                        containerAdded = true;
                    }
                }

                // Add link from pod to kube node
                if (containerAdded) {
                    var nlink = {
                        source: {
                            id: pod.id + '-' + kubeNode.id,
                            name: pod.name,
                            linktype: 'supporting',
                            nodetype: 'pod',
                            status: ''
                        },
                        target: kubeNode,
                        src: 'service',
                        tgt: 'node'
                    };
                    links.push(nlink);
                    kubeNodeHasContainers = true;
                }

            }

            // Hack! If the kube node has no containers / pods, we need to add it manually.
            if (!kubeNodeHasContainers) {
                nodes.push(kubeNode);
            }

        }

        addToGraph(links);
    }
}

function addToGraph(mylinks) {
    var xnodes = {};

    // Compute the distinct nodes from the links.
    mylinks.forEach(function(link) {
        link.source =
            xnodes[link.source.id] || (xnodes[link.source.id] = {
                id: link.source.id,
                name: link.source.name,
                namespace: link.source.namespace,
                nodetype: link.src,
                linktype: link.source.linktype,
                state: link.source.status,
                nodeId: link.source.nodeId
            });
        link.target =
            xnodes[link.target.id] || (xnodes[link.target.id] = {
                id: link.target.id,
                name: link.target.name,
                namespace: link.target.namespace,
                nodetype: link.tgt,
                linktype: link.target.linktype,
                state: link.target.status,
                nodeId: link.target.nodeId
            });
    });


    var added = [];

    for (var a = 0; a < mylinks.length; a++) {
        if (!contains(added, mylinks[a].source.id)) {
            nodes.push(mylinks[a].source);
            added.push(mylinks[a].source.id);
        }
        if (!contains(added, mylinks[a].target.id)) {
            nodes.push(mylinks[a].target);
            added.push(mylinks[a].target.id);
        }
        // Push link.
        links.push({source: mylinks[a].source, target: mylinks[a].target});

    }
    update_graph();

}

loadData();

function contains(a, obj) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}


      // Start long polling
      function poll(type) {
        oboe("/api/v1/" + type + "?watch")
            .done(function( evt ){
                console.log(evt);
                //handleWebSocketMessage(evt)
        });
      }
      poll("nodes");
      poll("pods");

function handleWebSocketMessage(evt) {
// When a NEW task has been added
if (evt.action === 'start' && evt.type === 'task') {
handleNewTaskEvent(evt);
}

// When a TASK has been stopped / deleted
if (evt.action === 'stop' && evt.type === 'task') {
handleRemoveTaskEvent(evt);
}

// Swarm Node updates
if (evt.action === 'update' && evt.type === 'node') {
if (evt.dnode.state === 'up') {
handleNewNodeEvent(evt);
}
if (evt.dnode.state === 'down') {
handleRemoveNodeEvent(evt);
}
}

// When a TASK has been stopped / deleted
if (evt.action === 'stop' && evt.type === 'node') {
handleRemoveNodeEvent(evt);
}

// A destroy means the entire service was deleted...
if (evt.action === 'stop' && evt.type === 'service') {
handleDestroyServiceEvent(evt);
}

// State change of a Node, typically: allocated -> preparing -> running
if (evt.action === 'update' && evt.type === 'task') {
handleTaskStateUpdate(evt);
}
}


// Start event handler functions

function handleNewNodeEvent(evt) {
    nodes.push({id: evt.dnode.id, nodetype: 'node', name: evt.dnode.name, linktype: 'supporting'});
    update_graph();
}

function handleRemoveNodeEvent(evt) {

    // Remove all service nodes and links pointing at the swarm node
    for (var b = 0; b < links.length; b++) {
        if (links[b].target.id === evt.dnode.id) {

            // Delete service node pointing at swarm node.
            deleteNodeById(nodes, links[b].source.id);

            // Delete the link
            links.splice(b, 1);
        }
    }

    // Delete the actual swarm node
    deleteNodeById(nodes, evt.dnode.id);
    update_graph();
    $("g:not(:has('>circle'))").remove();
}

function handleTaskStateUpdate(evt) {
    // Cosmetic changes can be applied directly on the DOM instead of through D3 update cycle.
    $('#' + evt.id).attr('class', 'node container ' + evt.state);
    var node = findNodeById(nodes, evt.id);
    if (notNull(node)) {
        node.state = evt.state;
    }
}

function handleDestroyServiceEvent(evt) {
    // Destroying a service removes it from ALL nodes. Find all nodes.
    var swarmNodes = findNodesByType(nodes);
    _.each(swarmNodes, function(swarmNode) {
        var serviceId = evt.dservice.id + '-' + swarmNode.id;


        for (var b = 0; b < links.length; b++) {
            if (links[b].source.id === serviceId) {
                links.splice(b, 1);
            }
        }
        deleteNodeById(nodes, serviceId);
    });

    update_graph();

    // Ugly hack to remove texts that doesn't want to be removed
    $("g:not(:has('>circle'))").remove();
}


function handleRemoveTaskEvent(evt) {
    console.log("Removing task");

    // Find node to remove
    var id = evt.dtask.id;
    var node = findNodeById(nodes, id);

    // Can't find node? Just return
    if (isNull(node)) return;

    // Remove unused links
    for (var b = 0; b < links.length; b++) {
        if (links[b].source.id === id || links[b].target.id === id) {
            links.splice(b, 1);
            break;
        }
    }

    // Delete the node from nodes
    deleteNodeById(nodes, id);
    update_graph();

    // Ugly hack to remove texts that doesn't want to be removed
    $("g:not(:has('>circle'))").remove();
}


function handleNewTaskEvent(evt) {
    console.log("Adding new task");
    // A service instance node is always identified by its own ID and the node we're dealing with.
    var serviceId = evt.dtask.serviceId + '-' + evt.dtask.nodeId;

    // this MAY be a new service coming up with (n) replicas. Check if we have a service node for the serviceId
    var serviceNode = findNodeById(nodes, serviceId);

    // If the service didn't exist, we create a new node for the service first...
    if (isNull(serviceNode)) {
        // Find the swarm node...
        var swarmNode = findNodeById(nodes, evt.dtask.nodeId);

        // Push the new service node.
        // TODO determine linktype from service name
        var linktype = resolveLinkTypeFromName(evt.dtask.name);
        var newService = {
            id: serviceId,
            name: evt.dtask.name,
            nodetype: 'service',
            linktype: linktype,
            state: ''
        };
        nodes.push(newService);

        // Push it's link to the swarm node
        links.push({source: newService, target: swarmNode});
    }

    // Construct the new TASK node
    var newNode = {
        id: evt.dtask.id,
        name: evt.dtask.name,
        nodetype: 'container',
        linktype: 'serviceinstance',
        state: evt.dtask.status
    };

    // Find service so we can create link
    if (isNull(serviceNode)) {
        serviceNode = findNodeById(nodes, serviceId);
    }

    if (isNull(serviceNode)) {
        console.log("ERROR ERROR ERROR: Unable to create service node for serviceId: " + serviceId +
                    " when creating task " + JSON.stringify(evt));
    }

    nodes.push(newNode);
    links.push({source: newNode, target: serviceNode});
    update_graph();
}

function resolveLinkTypeFromName(name) {
    if (name.indexOf("service") > -1) {
        return "serviceinstance";
    } else {
        return "supporting";
    }
}

// Start helper functions

function findNodeById(nodes, id) {
    var node = _.find(nodes, function(node) {
        return node.id === id;
    });

    if (isNull(node)) {
        console.log("findNodeById(nodes, '" + id + "') didn't find anything!!!!!!!!!!");
    }
    return node;
}

function findNodesByType(nodes, type) {
    return _.where(nodes, {nodetype: 'node'});
}

function deleteNodeById(nodes, id) {
    for (var a = 0; a < nodes.length; a++) {
        if (nodes[a].id === id) {
            nodes.splice(a, 1);
            break;
        }
    }
}

function notNull(obj) {
    return obj != null && typeof obj !== 'undefined';
}
function isNull(obj) {
    return obj == null || typeof obj === 'undefined';
}


