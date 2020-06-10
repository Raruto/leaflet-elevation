export const Area = (props) => {
	return path => {
		let interpolation = props.interpolation || "curveLinear";

		if (typeof props.interpolation !== 'function') {
			interpolation = d3[props.interpolation];
		}

		let area = d3.area().curve(interpolation)
			.x(d => (d.xDiagCoord = props.scaleX(d[props.xAttr])))
			.y0(props.height)
			.y1(d => props.scaleY(d[props.yAttr]));

		if (props.data) path.datum(props.data).attr("d", area);
		if (props.name) path.attr('data-name', props.name);

		return area;
	};
};

export const AreaPath = (props) => {
	return d3.create('svg:path')
		.attr("class", "area")
		.call(Area(props));
};

export const Axis = (props) => {
	return g => {
		props = L.extend({ type: "axis", tickSize: 6, tickPadding: 3 }, props);

		let [w, h] = [0, 0];
		if (props.axis == "x" && props.position == "top") {
			[w, h] = [0, 0];
		} else if (props.axis == "x" && props.position == "bottom") {
			[w, h] = [0, props.height];
		} else if (props.axis == "y" && props.position == "left") {
			[w, h] = [0, 0];
		} else if (props.axis == "y" && props.position == "right") {
			[w, h] = [props.width, 0];
		}

		if (props.axis == "x" && props.type == "grid") {
			props.tickSize = -props.height;
		} else if (props.axis == "y" && props.type == "grid") {
			props.tickSize = -props.width;
		}

		let scale = d3["axis" + props.position.replace(/\b\w/g, l => l.toUpperCase())]()
			.scale(props.scale)
			.ticks(props.ticks)
			.tickPadding(props.tickPadding)
			.tickSize(props.tickSize)
			.tickFormat(props.tickFormat);

		let axis = g.append("g")
			.attr("class", [props.axis, props.type, props.position].join(" "))
			.attr("transform", "translate(" + w + "," + h + ")")
			.call(scale);

		if (props.label) {
			axis.append("text")
				.attr("x", props.labelX)
				.attr("y", props.labelY)
				.text(props.label);
		}

		return axis;
	};
};

export const DragRectangle = (props) => {
	return rect => {
		let x1 = Math.min(props.dragStartCoords[0], props.dragEndCoords[0]);
		let x2 = Math.max(props.dragStartCoords[0], props.dragEndCoords[0]);

		return rect
			.attr("width", x2 - x1)
			.attr("height", props.height)
			.attr("x", x1);
	};
};

export const FocusRect = (props) => {
	return rect => rect
		.attr("width", props.width)
		.attr("height", props.height)
		.style("fill", "none")
		.style("stroke", "none")
		.style("pointer-events", "all");
};

export const Grid = (props) => {
	props.type = "grid";
	return Axis(props);
};

export const HeightFocusLine = (props) => {
	return line => line
		.attr("class", props.theme + " height-focus line")
		.attr("x1", props.xCoord || 0)
		.attr("x2", props.xCoord || 0)
		.attr("y1", props.yCoord || 0)
		.attr("y2", props.length || 0);
};

export const HeightFocusLabel = (props) => {
	return text => {
		text
			.attr("class", props.theme + " height-focus-label")
			.style("pointer-events", "none")
			.attr("x", props.xCoord + 5 || 0)
			.attr("y", props.yCoord || 0);

		let y = text.select(".height-focus-y");
		if (!y.node()) y = text.append("svg:tspan");

		y
			.attr("class", "height-focus-y")
			.text(props.label);

		text.selectAll('tspan').attr("x", props.xCoord + 5 || 0);

		return text;
	};
};

export const HeightFocusPoint = (props) => {
	return circle => circle
		.attr("class", props.theme + " height-focus circle-lower")
		.attr("transform", "translate(" + (props.xCoord || 0) + "," + (props.yCoord || 0) + ")")
		.attr("r", 6)
		.attr("cx", 0)
		.attr("cy", 0);
};


export const LegendItem = (props) => {
	return g => {
		g
			.attr("class", "legend-item legend-" + props.name.toLowerCase())
			.attr("data-name", props.name);

		g.append("rect")
			.attr("class", "area")
			.attr("x", (props.width / 2) - 50)
			.attr("y", props.height + props.margins.bottom / 2)
			.attr("width", 50)
			.attr("height", 10)
			.attr("opacity", 0.75);

		g.append('text')
			.text(L._(props.name))
			.attr("x", (props.width / 2) + 5)
			.attr("font-size", 10)
			.style("text-decoration-thickness", "2px")
			.style("font-weight", "700")
			.attr('y', props.height + props.margins.bottom / 2)
			.attr('dy', "0.75em");

		return g;
	}
};

export const MouseFocusLine = (props) => {
	return line => line
		.attr('class', 'mouse-focus-line')
		.attr('x2', props.xCoord)
		.attr('y2', 0)
		.attr('x1', props.xCoord)
		.attr('y1', props.height);
};

export const MouseFocusLabel = (props) => {
	return g => {

		g.attr('class', 'mouse-focus-label');

		let rect = g.select(".mouse-focus-label-rect");
		let text = g.select(".mouse-focus-label-text");
		let y = text.select(".mouse-focus-label-y");
		let x = text.select(".mouse-focus-label-x");

		if (!rect.node()) rect = g.append("rect");
		if (!text.node()) text = g.append("svg:text");
		if (!y.node()) y = text.append("svg:tspan");
		if (!x.node()) x = text.append("svg:tspan");

		if (props.labelY) y.text(props.labelY);
		if (props.labelX) x.text(props.labelX);

		// Sets focus-label-text position to the left / right of the mouse-focus-line
		let bbox = text.node().getBBox();
		let xAlign = 0;
		let yAlign = 0;

		if (props.xCoord) xAlign = props.xCoord + (props.xCoord < props.width / 2 ? 10 : -bbox.width - 10);
		if (props.yCoord) yAlign = Math.max(props.yCoord - bbox.height, L.Browser.webkit ? 0 : -Infinity);

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

export const Scale = (props) => {
	let domain = props.data ? d3.extent(props.data, d => d[props.attr]) : [0, 1];
	if (props.hasOwnProperty('min') && (props.min < domain[0] || props.forceBounds)) {
		domain[0] = props.min;
	}
	if (props.hasOwnProperty('max') && (props.max > domain[1] || props.forceBounds)) {
		domain[1] = props.max;
	}
	return d3.scaleLinear()
		.range(props.range)
		.domain(domain);
};
