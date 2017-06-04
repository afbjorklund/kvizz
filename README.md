# Dvizz - A Docker Swarm Visualizer
Inspired by the excellent [ManoMarks/docker-swarm-visualizer](https://github.com/ManoMarks/docker-swarm-visualizer), Dvizz provides an alternate way to render your Docker Swarm nodes, services and tasks using the D3 [Force Layout](https://github.com/d3/d3-3.x-api-reference/blob/master/Force-Layout.md).

![Dvizz image](dvizz1.png)

Legend:
- Big Gray circle: *Docker Swarm Node*
- Medium size red circle: *Docker Swarm Service*
- Small green circle: *Docker Swarm Task*

Task states
- Green: *running*
- Green with red border: *preparing*
- Gray: *allocated*

#### Why tasks and not containers?
There is an event stream one can subscribe to from the Docker Remote API that provides live updates of the state of services and containers. However, that stream only includes changes occurring on the same Swarm Node that is providing the docker.sock to the subscriber. 

Since dvizz requires us to run on the Swarm Manager, using /events stream would effectively make us miss all events emitted from other nodes in the Swarm. Since queries for *nodes*, *services* and *tasks* over the docker.sock returns the global state (i.e. across the whole swarm) we're basing Dvizz on tasks rather than containers.

An option could be to create some kind of "dvizz agent" that would need to run on each node and subscribe to that nodes very own /events channel (given that the worker nodes actually supply that?) and then use some messaging mechanism to collect events to the "dvizz master" for propagation to the GUI.

