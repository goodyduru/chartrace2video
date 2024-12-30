/**
 * Based on https://observablehq.com/@d3/bar-chart-race-explained
 */

class Dimensions {
    constructor(n) {
        const WIDTH = 1920;
        const HEIGHT = 1080;
        this.width = WIDTH/window.devicePixelRatio;
        this.height = HEIGHT/window.devicePixelRatio;
        this.margin = {top: 16, right: 6, bottom: 6, left: 0};
        this.n = n;
        this.barSize = (this.height - (this.margin.top+this.margin.bottom)) / this.n;
        this.barFontSize = 0.25 * this.barSize;
        this.x = d3.scaleLinear([0, 1], [this.margin.left, this.width - this.margin.right]);
        this.y = d3.scaleBand().domain(d3.range(this.n+1))
            .rangeRound([this.margin.top, this.margin.top + this.barSize * (this.n + 1 + 0.1)]).padding(0.1);
    }
}


class Canvas {
    constructor(dimensions) {
        let canvas = document.createElement("canvas");
        let dp = window.devicePixelRatio;
        canvas.width = dimensions.width * dp;
        canvas.height = dimensions.height * dp;
        let ctx = canvas.getContext("2d");
        ctx.scale(dp, dp);
        this.canvas = canvas;
        this.ctx = ctx;
        this.dimensions = dimensions;
    }

    getStream() {
        let stream = this.canvas.captureStream(25);
        return stream;
    }

    observe(node) {
        let observer = new MutationObserver((mutationList, observer) => {this.render()});
        let config = { attributes: true, childList: true, subtree: true };
        observer.observe(node, config);
    }

    render() {
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);
        this.renderTicksText();
        this.renderBars();
        this.renderTicks();
        this.renderLabels();
        this.renderTicker();
    }

    renderTicksText() {
        let ticks = document.querySelectorAll(".tick");
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "top";
        this.ctx.font = "10px sans-serif";
        ticks.forEach((t, i) => {
            if ( i == 0 ) {
                return;
            }
            let x = t.transform.baseVal.getItem(0).matrix.e;
            let text  = t.lastChild.textContent;
            this.ctx.fillStyle = "black";
            this.ctx.fillText(text, x, 0);
        });
    }

    renderBars() {
        let rects = document.querySelectorAll("rect");
        rects.forEach((t) => {
            let fill = t.getAttribute("fill");
            let height = t.getAttribute("height");
            let width = t.getAttribute("width");
            let x = t.getAttribute("x");
            let y = t.getAttribute("y");
            this.ctx.fillStyle = fill;
            this.ctx.globalAlpha = 0.6;
            this.ctx.fillRect(x, y, width, height);
            this.ctx.globalAlpha = 1.0;
        });
    }
        
    renderTicks() {  
        let ticks = document.querySelectorAll(".tick");
        let to = this.dimensions.barSize * (this.dimensions.n + this.dimensions.y.padding()) + 15;
        ticks.forEach((t, i) => {
            let x = Math.round(t.transform.baseVal.getItem(0).matrix.e);
            this.ctx.beginPath();
            this.ctx.moveTo(x, 10);
            this.ctx.lineTo(x, to);
            if ( i == 0 ) {
                this.ctx.strokeStyle = "black";
                this.ctx.stroke();
            } else {
                this.ctx.strokeStyle = "white";
                this.ctx.stroke();
            }
        });
    }

    renderLabels() {
        let texts = document.querySelector(".labels");
        this.ctx.textAlign = "right";
        this.ctx.font = `bold ${this.dimensions.barFontSize}px sans-serif`;
        let x = -6;
        let dy =  (this.dimensions.y.bandwidth() / 2) + -0.25 * this.dimensions.barSize;
        let tsDy = (this.dimensions.y.bandwidth() / 2) + 0.15 * this.dimensions.barFontSize;
        let tsOpacity = 0.7;
        let txFont = `normal ${this.dimensions.barFontSize}px sans-serif`;
        texts.childNodes.forEach((node) => {
            let xTrans = Math.round(node.transform.baseVal.getItem(0).matrix.e);
            let yTrans = Math.round(node.transform.baseVal.getItem(0).matrix.f);
            let text = node.firstChild.textContent;
            let tsText = node.lastChild.textContent;
            this.ctx.save();
            this.ctx.translate(xTrans, yTrans);
            this.ctx.fillStyle = "black";
            this.ctx.fillText(text, x, dy);
            this.ctx.font = txFont;
            this.ctx.globalAlpha = tsOpacity;
            this.ctx.fillText(tsText, x, tsDy);
            this.ctx.restore();
        });
    }

    renderTicker() {
        let ticker = document.querySelector(".ticker").textContent;
        this.ctx.font = "bold 48px sans-serif";
        this.ctx.fillStyle = "black";
        this.ctx.fillText(ticker, this.dimensions.width - 6, this.dimensions.height - 50);
    }
}

class CanvasRecorder {
    constructor(stream) {
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "video/mp4; codecs=vp9"
        });
    }

    record(time) {
        let recordedChunks = [];
        return new Promise((res, rej) => {
            this.mediaRecorder.start(time);
    
            this.mediaRecorder.ondataavailable = (event) => {
                recordedChunks.push(event.data);
            };
    
            this.mediaRecorder.onstop = (event) => {
                let blob = new Blob(recordedChunks, {type: "video/mp4"});
                let url = URL.createObjectURL(blob);
                res(url);
            }
        });
    }

    stop() {
        this.mediaRecorder.requestData();
        // Use timer to allow buffer to clear
        setTimeout(() => { this.mediaRecorder.stop() }, 1000);
    }
}

class SVGViewer {
    constructor() {
        this.container = document.getElementById("container");
        this.formatNumber = d3.format(",d");
        this.formatDate = d3.utcFormat("%Y");
        let n = parseInt(document.getElementById("num").value);
        this.dimensions = new Dimensions(n);
        this.canvasObj = new Canvas(this.dimensions);
        this.canvasRecorder = new CanvasRecorder(this.canvasObj.getStream());
        this.keyframes = [];
        this.date_col = document.getElementById("date-col").value;
        this.value_col = document.getElementById("value-col").value;
        this.name_col = document.getElementById("label-col").value;
        this.videoContainer = document.getElementById("video-container");
        this.errors = [];
    }

    async race(file) {
        if ( file.type != "text/csv" ) {
            return;
        }
        const fileContent = await file.text();
        this.parseData(fileContent);
        if ( this.names === undefined ) {
            this.showError();
            return;
        }
        let duration = 250;
        const svg = d3.create("svg").attr("viewBox", [0, 0, this.dimensions.width, this.dimensions.height]);
        this.canvasObj.observe(svg.node());
        const updateBars = this.bars(svg);
        const updateAxis = this.axis(svg);
        const updateLabels = this.labels(svg);
        const updateTicker = this.ticker(svg);
        this.container.replaceChildren()
        this.container.appendChild(svg.node());
        const recording = this.canvasRecorder.record(2000);
        for ( const keyframe of this.keyframes ) {
            const transition = svg.transition().duration(duration).ease(d3.easeLinear);
            this.dimensions.x.domain([0, keyframe[1][0].value]);
            updateAxis(keyframe, transition);
            updateBars(keyframe, transition);
            updateLabels(keyframe, transition);
            updateTicker(keyframe, transition);
            await transition.end();
        }
        this.canvasRecorder.stop();
        this.showVideo(recording);
    }

    parseData(fileContent) {
        let data = d3.csvParse(fileContent, d3.autoType);
        if ( !(this.date_col in data[0]) ) {
            this.errors.push({name: "Date", given: this.date_col});
        }
        if ( !(this.value_col in data[0]) ) {
            this.errors.push({name: "Value", given: this.value_col});
        }

        if ( !(this.name_col in data[0]) ) {
            this.errors.push({name: "Label", given: this.name_col});
        }

        if ( this.errors.length > 0 ) {
            return;
        }
        this.names = new Set(data.map(d => d[this.name_col]));
        let rollup = Array.from(d3.rollup(data, ([d]) => d[this.value_col], d => +d[this.date_col], d => d[this.name_col]));
        let maxDate = rollup[rollup.length-1][0];
        let minDate = rollup[0][0];
        let datevalues = rollup.map(([date, data]) => {
            if ( maxDate < 3000 && maxDate != minDate ) {
                return [new Date(date, 0, 2), data];
            } else {
                return [new Date(date), data];
            }
        }).sort(([a], [b]) => d3.ascending(a, b));
        this.generateKeyFrames(datevalues);
        let nameframes = d3.groups(this.keyframes.flatMap(([, data]) => data), d => d.name);
        this.prev = new Map(nameframes.flatMap(([, data]) => d3.pairs(data, (a, b) => [b, a])));
        this.next = new Map(nameframes.flatMap(([, data]) => d3.pairs(data)));
    
        const scale = d3.scaleOrdinal(d3.schemeTableau10);
        this.color = d => scale(d.name);
    }

    showError() {
        console.log(this.errors);
        let errorMessage = this.errors.map((err) => `${err.name} header name isn't called ${err.given}`).join("\n");
        alert(`${errorMessage}\n\nPlease ensure your header names exist in the csv file.`);
    }

    rank(value) {
        const data = Array.from(this.names, name => ({name, value: value(name)}));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for ( let i = 0; i < data.length; i++ ) data[i].rank = Math.min(i, this.dimensions.n);
        return data
    }

    generateKeyFrames(datevalues) {
        let k = 10;
        let ka, a, kb, b;
        for ( [[ka, a], [kb, b]] of d3.pairs(datevalues)) {
            for ( let i = 0; i < k; i++ ) {
                const t = i / k;
                this.keyframes.push([
                    new Date(ka * (1 - t)+ kb*t),
                    this.rank(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t)
                ]);
            }
        }
        for ( let i = 0; i < 2; i++ ) {
            this.keyframes.push([new Date(kb), this.rank(name => b.get(name) || 0)]);
        }
    }

    bars(svg) {
        let bar = svg.append("g").attr("fill-opacity", 0.6).selectAll('rect');
        return ([date, data], transition) => bar = bar
            .data(data.slice(0, this.dimensions.n), d => d.name)
            .join(
                enter => enter.append("rect")
                    .attr("fill", this.color)
                    .attr("height", this.dimensions.y.bandwidth())
                    .attr("x", this.dimensions.x(0))
                    .attr("y", d => this.dimensions.y((this.prev.get(d) || d).rank))
                    .attr("width", d => this.dimensions.x((this.prev.get(d) || d).value) - this.dimensions.x(0)),
                update => update,
                exit => exit.transition(transition).remove()
                    .attr("y", d => this.dimensions.y((this.next.get(d) || d).rank))
                    .attr("width", d => this.dimensions.x((this.prev.get(d) || d).value) - this.dimensions.x(0))
            )
            .call(bar => bar.transition(transition)
                .attr("y", d => this.dimensions.y(d.rank)))
                .attr("width", d => this.dimensions.x(d.value) - this.dimensions.x(0));
    }

    labels(svg) {
        let label = svg.append("g")
            .style("font", `bold ${this.dimensions.barFontSize}px sans-serif`)
            .style("font-variant-numeric", "tubular-nums")
            .attr("class", "labels")
            .attr("text-anchor", "end")
            .selectAll("text");
        
        return ([date, data], transition) => label = label
            .data(data.slice(0, this.dimensions.n), d => d.name)
            .join(
                enter => enter.append("text")
                .attr("transform", d => `translate(${this.dimensions.x((this.prev.get(d) || d).value)}, ${this.dimensions.y((this.prev.get(d) || d).rank)})`)
                .attr("y", this.dimensions.y.bandwidth() / 2)
                .attr("x", -6)
                .attr("dy", "-0.25em")
                .text(d => d.name)
                .call(text => text.append("tspan")
                    .attr("fill-opacity", 0.7)
                    .attr("font-weight", "normal")
                    .attr("x", -6)
                    .attr("dy", "1.15em")),
                update => update,
                exit => exit.transition(transition).remove()
                    .attr("transform", d => `translate(${this.dimensions.x((this.next.get(d) || d).value)}, ${this.dimensions.y((this.next.get(d) || d).rank)})`)
                    .call(g => g.select("tspan").textTween((d) => d3.interpolateRound(d.value, (this.next.get(d) || d).value)))
            ).call(bar => bar.transition(transition).attr("transform", d => `translate(${this.dimensions.x(d.value)}, ${this.dimensions.y(d.rank)})`)
                .call(g => g.select("tspan").textTween((d) => (t) => this.formatNumber(d3.interpolateNumber((this.prev.get(d) || d).value, d.value)(t))))
            );
    }

    axis(svg) {
        const g = svg.append("g").attr("transform", `translate(0, ${this.dimensions.margin.top})`);
        const axis = d3.axisTop(this.dimensions.x)
            .ticks(this.dimensions.width / 160)
            .tickSizeOuter(0)
            .tickSizeInner(-this.dimensions.barSize * (this.dimensions.n + this.dimensions.y.padding()));
        return (_, transition) => {
            g.transition(transition).call(axis);
            g.select(".tick:first-of-type text").remove();
            g.selectAll(".tick:not(:first-of-type) line").attr("stroke", "white");
            g.select(".domain").remove();
        }
    }
    
    ticker(svg) {
        const now = svg.append("text")
            .style("font", `bold 48px sans-serif`)
            .style("font-variant-numeric", "tubular-nums")
            .attr("class", "ticker")
            .attr("text-anchor", "end")
            .attr("x",this.dimensions.width - 6)
            .attr("y", this.dimensions.height - 50)
            .attr("dy", "0.32em")
            .text(this.formatDate(this.keyframes[0][0]));
        return ([date], transition) => {
            transition.end().then(() => now.text(this.formatDate(date)));
        }
    }

    showVideo(recording) {
        recording.then(url => {
            this.videoContainer.innerHTML = `<video controls src="${url}" width="${this.videoContainer.clientWidth}"></video>`;
            this.videoContainer.scrollIntoView();
        });
    }
}

function addEventListeners() {
    const fileElement = document.getElementById("file");
    const btnElement = document.getElementById("submit");
    const numElement = document.getElementById("num");
    const dateElement = document.getElementById("date-col");
    const labelElement = document.getElementById("label-col");
    const valueElement = document.getElementById("value-col");

    function validInputs() {
        let num = parseInt(numElement.value);
        return ( !isNaN(num) && num > 0 && dateElement.value.trim() != "" && 
            labelElement.value.trim() != "" && valueElement.value.trim() != "" && fileElement.files.length > 0 );
    }

    fileElement.addEventListener('change', (e) => {
        if ( validInputs() ) {
            btnElement.removeAttribute("disabled");
        } else {
            btnElement.setAttribute("disabled", "true");
        }
    });

    [numElement, dateElement, labelElement, valueElement].forEach((el) => {
        el.addEventListener("input", (event) => {
            if ( validInputs() ) {
                btnElement.removeAttribute("disabled");
            } else {
                btnElement.setAttribute("disabled", "true");
            }
        })
    });

    btnElement.addEventListener("click", (event) => {
        event.preventDefault();
        if ( !validInputs() ) {
            return;
        }
        let svgViewer = new SVGViewer();
        svgViewer.race(fileElement.files[0])
    });
}


addEventListeners();