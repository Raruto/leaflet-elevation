export const Colors = {
	'lightblue': { area: '#3366CC', alpha: 0.45, stroke: '#3366CC' },
	'magenta'  : { area: '#FF005E' },
	'yellow'   : { area: '#FF0' },
	'purple'   : { area: '#732C7B' },
	'steelblue': { area: '#4682B4' },
	'red'      : { area: '#F00' },
	'lime'     : { area: '#9CC222', line: '#566B13' }
};

export const Area = ({
	width,
	height,
	xAttr,
	yAttr,
	scaleX,
	scaleY,
	interpolation = "curveLinear"
}) => {
	if (typeof interpolation === 'string') interpolation = d3[interpolation];

	let area = d3.area().curve(interpolation)
		.x(d => (d.xDiagCoord = scaleX(d[xAttr])))
		.y0(height)
		.y1(d => scaleY(d[yAttr]));

	return area;
};

export const Path = ({
	name,
	color,
	strokeColor,
	strokeOpacity,
	fillOpacity,
	preferCanvas,
	detached,
}) => {
	let path = d3.create('svg:path')

	if (name) path.attr('data-name', name);

	path.style("pointer-events", "none");

	if (preferCanvas !== false) {
		path
		.attr("fill", color || '#3366CC')
		.attr("stroke", strokeColor || '#000')
		.attr("stroke-opacity", strokeOpacity || '1')
		.attr("fill-opacity", fillOpacity || '0.8');
	}

	return path;
};

export const Axis = ({
	type = "axis",
	tickSize = 6,
	tickPadding = 3,
	position,
	height,
	width,
	axis,
	scale,
	ticks,
	tickFormat,
	label,
	labelX,
	labelY,
	name = ""
}) => {
	return g => {
		let [w, h] = [0, 0];
		if (position == "bottom") h = height;
		if (position == "right")  w = width;

		if (axis == "x" && type == "grid") {
			tickSize = -height;
		} else if (axis == "y" && type == "grid") {
			tickSize = -width;
		}

		let axisScale = d3["axis" + position.replace(/\b\w/g, l => l.toUpperCase())]()
			.scale(scale)
			.ticks(ticks)
			.tickPadding(tickPadding)
			.tickSize(tickSize)
			.tickFormat(tickFormat);

		let axisGroup = g.append("g")
			.attr("class", [axis, type, position, name].join(" "))
			.attr("transform", "translate(" + w + "," + h + ")")
			.call(axisScale);

		if (label) {
			axisGroup.append("svg:text")
				.attr("x", labelX)
				.attr("y", labelY)
				.text(label);
		}

		return axisGroup;
	};
};

export const DragRectangle = ({
	dragStartCoords,
	dragEndCoords,
	height,
}) => {
	return rect => {
		let x1 = Math.min(dragStartCoords[0], dragEndCoords[0]);
		let x2 = Math.max(dragStartCoords[0], dragEndCoords[0]);

		return rect
			.attr("width", x2 - x1)
			.attr("height", height)
			.attr("x", x1);
	};
};

export const FocusRect = ({
	width,
	height,
}) => {
	return rect => rect
		.attr("width", width)
		.attr("height", height)
		.style("fill", "none")
		.style("stroke", "none")
		.style("pointer-events", "all");
};

export const Grid = (props) => {
	props.type = "grid";
	return Axis(props);
};

export const HeightFocusLine = ({
	theme,
	xCoord = 0,
	yCoord = 0,
	length = 0,
}) => {
	return line => line
		.attr("class", theme + " height-focus line")
		.attr("x1", xCoord)
		.attr("x2", xCoord)
		.attr("y1", yCoord)
		.attr("y2", length);
};

export const HeightFocusLabel = ({
	theme,
	xCoord = 0,
	yCoord = 0,
	label,
}) => {
	return text => {
		text
			.attr("class", theme + " height-focus-label")
			.style("pointer-events", "none")
			.attr("x", xCoord + 5)
			.attr("y", yCoord);

		let y = text.select(".height-focus-y");
		if (!y.node()) y = text.append("svg:tspan");

		y
			.attr("class", "height-focus-y")
			.text(label);

		text.selectAll('tspan').attr("x", xCoord + 5);

		return text;
	};
};

export const HeightFocusMarker = ({
	theme,
	xCoord = 0,
	yCoord = 0,
}) => {
	return circle => circle
		.attr("class", theme + " height-focus circle-lower")
		.attr("transform", "translate(" + xCoord + "," + yCoord + ")")
		.attr("r", 6)
		.attr("cx", 0)
		.attr("cy", 0);
};


export const LegendItem = ({
	name,
  label,
	width,
	height,
	margins = {},
	color
}) => {
	return g => {
		g
			.attr("class", "legend-item legend-" + name.toLowerCase())
			.attr("data-name", name);

		g.append("svg:rect")
			.attr("x", (width / 2) - 50)
			.attr("y", height + margins.bottom / 2)
			.attr("width", 50)
			.attr("height", 10)
			.attr("fill", color)
			.attr("stroke", "#000")
			.attr("stroke-opacity", "0.5")
			.attr("fill-opacity", "0.25");

		g.append('svg:text')
			.text(L._(label || name))
			.attr("x", (width / 2) + 5)
			.attr("font-size", 10)
			.style("text-decoration-thickness", "2px")
			.style("font-weight", "700")
			.attr('y', height + margins.bottom / 2)
			.attr('dy', "0.75em");

		return g;
	}
};

export const MouseFocusLine = ({
	xCoord = 0,
	height,
}) => {
	return line => line
		.attr('class', 'mouse-focus-line')
		.attr('x2', xCoord)
		.attr('y2', 0)
		.attr('x1', xCoord)
		.attr('y1', height);
};

export const MouseFocusLabel = ({
	xCoord,
	yCoord,
	labelX = "",
	labelY = "",
	width,
}) => {
	return g => {

		g.attr('class', 'mouse-focus-label');

		let rect = g.select(".mouse-focus-label-rect");
		let text = g.select(".mouse-focus-label-text");
		let y    = text.select(".mouse-focus-label-y");
		let x    = text.select(".mouse-focus-label-x");

		if (!rect.node()) rect = g.append("svg:rect");
		if (!text.node()) text = g.append("svg:text");
		if (!y.node())    y    = text.append("svg:tspan");
		if (!x.node())    x    = text.append("svg:tspan");

		y.text(labelY);
		x.text(labelX);

		// Sets focus-label-text position to the left / right of the mouse-focus-line
		let xAlign = 0;
		let yAlign = 0;
		let bbox   = { width: 0, height: 0 };
		try { bbox = text.node().getBBox(); } catch (e) { return g; }

		if (xCoord) xAlign = xCoord + (xCoord < width / 2 ? 10 : -bbox.width - 10);
		if (yCoord) yAlign = Math.max(yCoord - bbox.height, L.Browser.webkit ? 0 : -Infinity);

		rect
			.attr("class", "mouse-focus-label-rect")
			.attr("x", xAlign - 5)
			.attr("y", yAlign - 5)
			.attr("width", bbox.width + 10)
			.attr("height", bbox.height + 10)
			.attr("rx", 3)
			.attr("ry", 3);
		text
			.attr("class", "mouse-focus-label-text")
			.style("font-weight", "700")
			.attr("y", yAlign);
		y
			.attr("class", "mouse-focus-label-y")
			.attr("dy", "1em");
		x
			.attr("class", "mouse-focus-label-x")
			.attr("dy", "2em");

		text.selectAll('tspan').attr("x", xAlign);

		return g;
	};
};

export const Ruler = ({
	height,
	width,
}) => {
	return g => {

		g.data([{
				"x": 0,
				"y": height,
			}])
			.attr("transform", d => "translate(" + d.x + "," + d.y + ")");

		g.append("svg:line")
			.attr("class", "horizontal-drag-line")
			.attr("x1", 0)
			.attr("x2", width);

		g.append("svg:text")
			.attr("class", "horizontal-drag-label")
			.attr("text-anchor", "end")
			.attr("x", width - 8)
			.attr("y", -8)

		g.selectAll()
			.data([{
				"type": d3.symbolTriangle,
				"x": width + 7,
				"y": 0,
				"angle": -90,
				"size": 50
			}])
			.enter()
			.append("svg:path")
			.attr("class", "horizontal-drag-symbol")
			.attr("d",
				d3.symbol()
				.type(d => d.type)
				.size(d => d.size)
			)
			.attr("transform", d => "translate(" + d.x + "," + d.y + ") rotate(" + d.angle + ")");

		return g;
	}
};

export const Scale = ({
	data,
	attr,
	min,
	forceBounds,
	range,
}) => {
	let domain = data ? d3.extent(data, d => d[attr]) : [0, 1];
	if (typeof min !== "undefined" && (min < domain[0] || forceBounds)) {
		domain[0] = min;
	}
	if (typeof max !== "undefined" && (max > domain[1] || forceBounds)) {
		domain[1] = max;
	}
	return d3.scaleLinear()
		.range(range)
		.domain(domain);
};

export const Bisect = ({
	data = [0, 1],
	scale,
	x,
	attr
}) => {
	return d3
		.bisector(d => d[attr])
		.left(data, scale.invert(x));
};

export const Chart = ({
	width,
	height,
	margins = {}
}) => {
	const svg   = d3.create("svg:svg")
		.attr("class", "background")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("width", width)
		.attr("height", height);

	const g     = svg
		.append("g")
		.attr("transform", "translate(" + margins.left + "," + margins.top + ")");

	const grid  = g.append("g").attr("class", "grid");
	const area  = g.append('g').attr("class", "area");
	const point = g.append('g').attr("class", "point");
	const axis  = g.append('g').attr("class", "axis");

	const _width  = width - margins.left - margins.right;
	const _height = height - margins.top - margins.bottom;

	const scale = (opts) => ({ x: Scale(opts.x), y: Scale(opts.y)});

	const chart = { svg, g, grid, area, point, axis, scale, _width, _height };

	return chart;
};
