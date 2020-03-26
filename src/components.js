const AxisRange = (props) => {
	if (!props.data) {
		let x = d3.scaleLinear().range([0, props.width]);
		let y = d3.scaleLinear().range([props.height, 0]);
		return [x, y];
	}

	let xdomain = d3.extent(props.data, d => d.dist);
	let ydomain = d3.extent(props.data, d => d.z);
	let opts = props.options;

	if (opts.yAxisMin !== undefined && (opts.yAxisMin < ydomain[0] || opts.forceAxisBounds)) {
		ydomain[0] = opts.yAxisMin;
	}
	if (opts.yAxisMax !== undefined && (opts.yAxisMax > ydomain[1] || opts.forceAxisBounds)) {
		ydomain[1] = opts.yAxisMax;
	}

	let x = props.x.domain(xdomain);
	let y = props.y.domain(ydomain);

	return [x, y];
};

const AreaPath = (props) => {
	if (!props.data) {
		let interpolation = typeof props.interpolation === 'function' ? props.interpolation : d3[props.interpolation];
		let area = d3.area().curve(interpolation)
			.x(d => (d.xDiagCoord = props.x(d.dist)))
			.y0(props.height)
			.y1(d => props.y(d.z));
		let path = d3.create("svg:path")
			.attr("class", "area");
		return [area, path];
	}

	props.path.datum(props.data).attr("d", props.area);

	return [props.path, props.area];
};

const Chart = (props) => {
	let container = d3.select(props.container);
	let svg = container.append("svg")
		.attr("class", "background")
		.attr("width", props.width)
		.attr("height", props.height);
	let g = svg
		.append("g")
		.attr("transform", "translate(" + props.options.margins.left + "," + props.options.margins.top + ")");
	return svg;
};

const Summary = (props) => {
	let container = d3.select(props.container);
	let summary = container.append("div")
		.attr("class", "elevation-summary " + props.summary + "-summary")
		.node();
	return summary;
};

export {
	AreaPath,
	AxisRange,
	Chart,
	Summary
};
