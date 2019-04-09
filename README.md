# Kvizz - A Kubernetes Visualizer
Inspired by the excellent [eriklupander/dvizz](https://github.com/eriklupander/dvizz.git), Kvizz provides an alternate way to render your Kubernetes nodes, pods and containers using the D3 [Force Layout](https://github.com/d3/d3-3.x-api-reference/blob/master/Force-Layout.md).

![Kvizz image](kvizz1.png)

Legend:
- Big Gray circle: *Kubernetes Node*
- Medium size red circle: *Kubernetes Pod*
- Small green circle: *CRI Container*

Task states
- Green: *running*
- Green with red border: *preparing*
- Gray: *allocated*

### Installation instructions

Proxy the kubernetes api and the www content:

    kubectl proxy --www=. &

Open a web browser to view the visualization:

    xdg-open http://localhost:8001/static/

# 3rd party libraries
- d3js.org (https://d3js.org/)
- oboe.js (http://oboejs.com/)

# License
MIT license, see [LICENSE](LICENSE)
