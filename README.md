### Introduction
Welcome to the source code of [Chart Race Video](https://chartrace.goodyduru.com/).

### How It Works
When the csv file is uploaded and everything is correct, a chart race animation runs in the browser. The code for that is based on Mike Bostock's code on [Observable](https://observablehq.com/@d3/bar-chart-race-explained). While the animation is running, it is replicated on an offscreen canvas. This canvas is then streamed to a video chunk using the [MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API). Once the animation stops running, the recording is added to the `src` of a newly created `video` tag which is added to the DOM.