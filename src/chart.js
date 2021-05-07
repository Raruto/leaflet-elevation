import 'leaflet-i18n';
import * as _  from './utils';
import * as D3 from './components';

export var Chart = L.Class.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	initialize: function(opts, control) {
		this.options       = opts;
		this.control       = control;

		this._data         = [];

		// cache registered components
		this._props        = {
			scales     : {},
			paths      : {},
			areas      : {},
			grids      : {},
			axes       : {},
			legendItems: {},
			focusLabels: {},
		};

		this._scales       = {};
		this._domains      = {};
		this._ranges       = {};
		this._paths        = {};

		this._brushEnabled = opts.dragging;
		this._zoomEnabled  = opts.zooming;

		if (opts.imperial) {
			this._xLabel  = "mi";
			this._yLabel  = "ft";
		} else {
			this._xLabel  = opts.xLabel;
			this._yLabel  = opts.yLabel;
		}

		let chart       = this._chart = D3.Chart(opts);

		// SVG Container
		let svg         = this._container = chart.svg;

		// Panes
		this._grid      = chart.pane('grid');
		this._area      = chart.pane('area');
		this._point     = chart.pane('point');
		this._axis      = chart.pane('axis');
		this._legend    = chart.pane('legend');

		// Scales
		this._initScale();

		// Helpers
		this._clipPath  = chart.get('clipPath');
		this._canvas    = chart.get('canvas');
		this._context   = chart.get('context');
		this._dragG     = chart.get('dragG');
		this._focusG    = chart.get('focusG');
		this._brush     = chart.get('brush');

		// Tooltip
		this._focusline  = this._focusG.select('.mouse-focus-line');
		this._focuslabel = this._focusG.select('.mouse-focus-label');

		this._zoom = d3.zoom();
		this._drag = d3.drag();

		// Interactions
		this._initInteractions();

		// svg.on('resize', (e)=>console.log(e.detail));

	},

	update: function(props) {
		if (props) {
			if (props.data) this._data = props.data;
			if (props.options) this.options = props.options;
		}

		this._updateScale();
		this._updateArea();
		this._updateAxis();
		this._updateLegend();
		this._updateClipper();

		return this;
	},

	render: function() {
		return container => container.append(() => this._container.node());
	},

	clear: function() {
		this._resetDrag();
		this._area.selectAll('path').attr("d", "M0 0");
		this._context.clearRect(0, 0, this._width(), this._height());
		if (this._path) {
			// this._x.domain([0, 1]);
			// this._y.domain([0, 1]);
		}
	},

	_drawPath: function(name) {
		let opts   = this.options;
		let ctx    = this._context;

		let path   = this._paths[name];
		let area   = this._props.areas[name];
		let node   = path.node();
		let scaleX = this._scales[area.scaleX];
		let scaleY = this._scales[area.scaleY];

		area = L.extend({}, area, {
			width        : this._width(),
			height       : this._height(),
			scaleX       : scaleX,
			scaleY       : scaleY
		});

		if (!scaleY || !scaleY) {
			return console.warn('Unable to render path:' + name);
		}

		path.datum(this._data).attr("d", D3.Area(area));

		if (path.classed('leaflet-hidden')) return;

		if (opts.preferCanvas) {
			path.classed('canvas-path', true);

			ctx.beginPath();
			ctx.moveTo(0, 0);
			let p = new Path2D(path.attr('d'));

			ctx.strokeStyle = path.attr('stroke');
			ctx.fillStyle   = path.attr('fill');
			ctx.lineWidth   = 1.25;
			ctx.globalCompositeOperation = 'source-over';

			// stroke opacity
			ctx.globalAlpha = path.attr('stroke-opacity') || 0.3;
			ctx.stroke(p);

			// fill opacity
			ctx.globalAlpha = path.attr('fill-opacity')   || 0.45;
			ctx.fill(p);

			ctx.globalAlpha = 1;

			ctx.closePath();
		} else {
			this._area.append(() => node);
		}
	},

	_hasActiveLayers: function() {
		const paths = this._paths;
		for (var i in paths) {
			if (!paths[i].classed('leaflet-hidden')) {
				return true;
			}
		}
		return false;
	},

	/**
	 * Initialize "d3-brush".
	 */
	_initBrush: function(e) {
		const brush   = (e) => {
			let extent  = e.selection;
			if (extent) {
				let start = this._findIndexForXCoord(extent[0]);
				let end   = this._findIndexForXCoord(extent[1]);
				this.fire('dragged', { dragstart: this._data[start], dragend: this._data[end] });
			}
		}

		const focus   = (e) => {
			if (e.type == 'brush' && !e.sourceEvent) return;
			let rect    = this._chart.panes.brush.select('.overlay').node();
			let coords  = d3.pointers(e, rect)[0];
			let xCoord  = coords[0];
			let item    = this._data[this._findIndexForXCoord(xCoord)];

			this.fire("mouse_move", { item: item, xCoord: xCoord });
		};

		this._brush
			.filter((e) => this._brushEnabled && !e.shiftKey && !e.button)
			.on("end.update", brush)
			.on("brush.update", focus);

		this._chart.panes.brush
			.on("mouseenter.focus touchstart.focus", this.fire.bind(this, "mouse_enter"))
			.on("mouseout.focus touchend.focus",     this.fire.bind(this, "mouse_out")  )
			.on("mousemove.focus touchmove.focus",   focus                              );

	},

	/**
	 * Initialize "d3-zoom"
	 */
	_initClipper: function() {
		let svg       = this._container;
		let margin    = this.options.margins;

		const zoom    = this._zoom;

		const onStart = (e) => {
			if (e.sourceEvent && e.sourceEvent.type == "mousedown") svg.style('cursor', 'grabbing');
			if (e.transform.k == 1 && e.transform.x == 0) {
				this._container.classed('zoomed', true);
			}
			this.zooming = true;
		};

		const onEnd  = (e) => {
			if (e.transform.k ==1 && e.transform.x == 0){
				this._container.classed('zoomed', false);
			}
			this.zooming = false;
			svg.style('cursor', '');
		};

		const onZoom = (e) => {
			// TODO: find a faster way to redraw the chart.
			this.zooming = false;
			this._updateScale(); // hacky way for restoring x scale when zooming out
			this.zooming = true;
			this._scales.distance = this._x = e.transform.rescaleX(this._x); // calculate x scale at zoom level
			this._resetDrag();
			if (e.sourceEvent && e.sourceEvent.type == "mousemove") {
				this._hideDiagramIndicator();
			}
			this.fire('zoom');
		};

		zoom
			.scaleExtent([1, 10])
			.extent([
				[margin.left, 0],
				[this._width() - margin.right, this._height()]
			])
			.translateExtent([
				[margin.left, -Infinity],
				[this._width() - margin.right, Infinity]
			])
			.filter((e) => this._zoomEnabled && (e.shiftKey || e.buttons == 4))
			.on("start", onStart)
			.on("end", onEnd)
			.on("zoom", onZoom);

		svg.call(zoom); // add zoom functionality to "svg" group

		// d3.select("body").on("keydown.grabzoom keyup.grabzoom", (e) => svg.style('cursor', e.shiftKey ? 'move' : ''));

	},

	_initInteractions: function() {
		this._initBrush();
		this._initRuler();
		this._initClipper();
		this._initLegend();
	},

	/**
	 * Toggle chart data on legend click
	 */
	_initLegend: function() {
		this._container.on('legend_clicked', (e) => {
			let { path, legend, name, enabled } = e.detail;

			if (!path) return;

			let label = _.select('text', legend);
			let rect  = _.select('rect', legend);

			_.toggleStyle(label, 'text-decoration-line', 'line-through', enabled);
			_.toggleStyle(rect,  'fill-opacity',         '0',            enabled);
			_.toggleClass(path,  'leaflet-hidden',                       enabled);

			this._updateArea();

			this.fire("elepath_toggle", { path, name, legend, enabled })
		});
	},

	/**
	 * Initialize "ruler".
	 */
	_initRuler: function() {
		if (!this.options.ruler) return;

		// const yMax      = this._height();
		const formatNum = d3.format(".0f");
		const drag      = this._drag;

		const label     = (e, d) => {
			let yMax      = this._height();
			let y         = this._dragG.data()[0].y;
			if (y >= yMax || y <= 0) this._dragG.select(".horizontal-drag-label").text('');
			this._hideDiagramIndicator();
		};

		const position  = (e, d) => {
			let yMax      = this._height();
			let yCoord    = d3.pointers(e, this._area.node())[0][1];
			let y         = yCoord > 0 ? (yCoord < yMax ? yCoord : yMax) : 0;
			let z         = this._y.invert(y);
			let data      = L.extend(this._dragG.data()[0], { y: y });

			this._dragG
				.data([data])
				.attr("transform", d => "translate(" + d.x + "," + d.y + ")")
				.classed('active', y < yMax);

			this._container.select(".horizontal-drag-label")
				.text(formatNum(z) + " " + this._yLabel);

			this.fire('ruler_filter', { coords: yCoord < yMax && yCoord > 0 ? this._findCoordsForY(yCoord) : [] });
		}

		drag
		.on("start end", label)
		.on("drag", position);

		this._dragG.call(drag);

	},

	/**
	 * Initialize x and y scales
	 */
	_initScale: function() {
		let opts = this.options;

		this._registerAxisScale({
			axis    : 'x',
			position: 'bottom',
			attr    : opts.xAttr,
			min     : opts.xAxisMin,
			max     : opts.xAxisMax,
			name    : 'distance'
		});

		this._registerAxisScale({
			axis     : 'y',
			position : 'left',
			attr     : opts.yAttr,
			min      : opts.yAxisMin,
			max      : opts.yAxisMax,
			name     : 'altitude'
		});

		this._x = this._scales.distance;
		this._y = this._scales.altitude;
	},

	_registerAreaPath: function(props) {
		let opts = this.options;

		if (!props.xAttr) props.xAttr = opts.xAttr;
		if (!props.yAttr) props.yAttr = opts.yAttr;
		if (typeof props.preferCanvas === "undefined") props.preferCanvas = opts.preferCanvas;

		let path = D3.Path(props);

		// Save paths in memory for latter usage
		this._paths[props.name]       = path;
		this._props.areas[props.name] = props;

		if (opts.legend) {
			this._props.legendItems[props.name] = {
				name   : props.name,
				label  : props.label,
				color  : props.color,
				path   : path
			};
		}

	},

	_registerAxisGrid: function(props) {
		this._props.grids[props.name || props.axis] = props;
	},

	_registerAxisScale: function(props) {
		let opts  = this.options;
		let scale = props.scale;

		if (typeof scale !== 'function') {
			scale       = L.extend({
				data       : this._data,
				forceBounds: opts.forceAxisBounds
			}, scale);

			scale.attr   = scale.attr || props.name;

			let domain   = this._domains[props.name] = D3.Domain(props);
			let range    = this._ranges[props.name]  = D3.Range(props);
			scale.range  = scale.range  || range(this._width(),this._height());
			scale.domain = scale.domain || domain(this._data);

			this._props.scales[props.name] = scale;

			props.scale = this._scales[props.name] = D3.Scale(scale);
		}

		if (!props.ticks) {
			if (props.axis == 'x')      props.ticks = opts.xTicks;
			else if (props.axis == 'y') props.ticks = opts.yTicks;
		}

		this._props.axes[props.name] = props;

		return scale;
	},

	/**
	 * Add a waypoint of interest over the chart
	 */
	_registerCheckPoint: function(point) {
		if (!this._data.length) return;

		let item, x, y;

		if (point.latlng) {
			item = this._data[this._findIndexForLatLng(point.latlng)];
			x    = this._x(item.dist);
			y    = this._y(item.z);
		} else if (!isNaN(point.dist)) {
			x    = this._x(point.dist);
			item = this._data[this._findIndexForXCoord(x)]
			y    = this._y(item.z);
		} else

		if (isNaN(x) || isNaN(y)) return;

		if (!point.item || !point.item.property('isConnected')) {
			point.position = point.position || "bottom";

			point.item = this._point.append('g');

			point.item.append("svg:line")
				.attr("y1", 0)
				.attr("x1", 0)
				.attr("style","stroke: rgb(51, 51, 51); stroke-width: 0.5; stroke-dasharray: 2, 2;");

			point.item
				.append("svg:circle")
				.attr("class", " height-focus circle-lower")
				.attr("r", 3);

			if (point.label) {
				point.item.append("svg:text")
					.attr("dx", "4px")
					.attr("dy", "-4px");
			}
		}

		point.item
			.datum({
				pos: point.position,
				x: x,
				y: y
			})
			.attr("class", d => "point " + d.pos)
			.attr("transform", d => "translate(" + d.x + "," + d.y + ")");

		point.item.select('line')
			.datum({
				y2: ({'top': -y, 'bottom': this._height() - y})[point.position],
				x2: ({'left': -x, 'right': this._width() - x})[point.position] || 0
			})
			.attr("y2", d => d.y2)
			.attr("x2", d => d.x2)

		if (point.label) {
			point.item.select('text')
				.text(point.label);
		}

	},

	_registerFocusLabel: function(props) {
		this._props.focusLabels[props.name] = props;
	},

	_updateArea: function() {
		let paths = this._paths;
		// Reset and update chart profiles
		this._context.clearRect(0, 0, this._width(), this._height());
		for (var i in paths) {
			if (!paths[i].classed('leaflet-hidden')) {
				this._drawPath(i);
			}
		}
	},

	_updateAxis: function() {

		let opts = this.options;

		// Reset chart axis.
		this._grid.selectAll('g').remove();
		this._axis.selectAll('g').remove();

		let grids = this._props.grids;
		let axes  = this._props.axes;
		let props, axis, grid;

		let gridOpts = {
			width     : this._width(),
			height    : this._height(),
			tickFormat: "",
		};
		let axesOpts  = {
			width  : this._width(),
			height : this._height(),
		};

		// Render grids
		for (let i in grids) {
			props = L.extend({}, gridOpts, grids[i]);
			grid  = D3.Grid(props);
			this._grid.call(grid);
		}

		// Render axis
		for (let i in axes) {
			if (opts[i] === false || opts[i] === 'summary') continue;
			props = L.extend({}, axesOpts, axes[i]);
			axis  = D3.Axis(props);
			this._axis.call(axis);
		}

		// Adjust axis scale positions
		this._axis
			.selectAll('.y.axis.right')
			.each((d, i, n) => {

				let axis      = d3.select(n[i]);
				let transform = axis.attr('transform');
				let translate = transform.substring(transform.indexOf("(") + 1, transform.indexOf(")")).split(",");

				axis.attr('transform', 'translate(' + (+translate[0] + (i * 40)) + ',' + translate[1] + ')')

				if (i > 0) {
					axis.select(':scope > path')         .attr('opacity', 0.25);
					axis.selectAll(':scope > .tick line').attr('opacity', 0.75);
				}

			});

	},

	_updateClipper: function() {
		let margin = this.options.margins;

		this._zoom
			.scaleExtent([1, 10])
			.extent([
				[margin.left, 0],
				[this._width() - margin.right, this._height()]
			])
			.translateExtent([
				[margin.left, -Infinity],
				[this._width() - margin.right, Infinity]
			]);

	},

	_updateLegend: function () {
		let legends = this._props.legendItems;
		let legend;

		// Reset legend items
		this._legend.selectAll('g').remove();
		for (var i in legends) {
			legend = D3.LegendItem(
				L.extend({
					width  : this._width(),
					height : this._height(),
					margins: this.options.margins,
				}, legends[i])
			)
			this._legend.append("g").call(legend);
		}

		// Get legend items
		let items  = this._legend.selectAll('.legend-item');

		// Calculate legend item positions
		let n    = items.nodes().length;
		let v      = Array(Math.floor(n / 2)).fill(null).map((d, i) => (i + 1) * 2 - (1 - Math.sign(n % 2)));
		let rev    = v.slice().reverse().map((d) => -(d));

		if (n % 2 !== 0) {
			rev.push(0);
		}
		v = rev.concat(v);

		// Get chart margins
		let xAxesB  = this._axis.selectAll('.x.axis.bottom').nodes().length;
		let marginB = 60 + (xAxesB * 2);
		let marginR = n * 30;

		// Adjust chart right margins
		if (n && this.options.margins.right != marginR) {
			this.options.margins.right  = marginR;
			this.fire('margins_updated');
		}

		// Adjust chart bottom margins
		if(xAxesB && this.options.margins.bottom != marginB) {
			this.options.margins.bottom = marginB;
			this.fire('margins_updated');
		}

		items
			.each((d, i, n) => {

				let legend  = d3.select(n[i]);
				let rect    = legend.select('rect');
				let name    = legend.attr('data-name');
				let path    = this._paths[name];

				let tx      = v[i] * 55;
				let ty      = xAxesB * 2;

				legend

				// Adjust legend item positions
				.attr("transform", "translate(" + tx + ", " + ty + ")");

				// Set initial state (disabled controls)
				if (name in this.options && this.options[name] == 'disabled') {
					path.classed('leaflet-hidden', true);
					legend.select('text').style('text-decoration-line', 'line-through');
					legend.select('rect').style('fill-opacity', '0');
				}

				// Apply d3-zoom (bind <clipPath> mask)
				if (this._clipPath) {
					path.attr('clip-path', 'url(#' + this._clipPath.attr('id') + ')');
				}

			});
	},

	_updateScale: function() {
		if (this.zooming) return { x: this._x, y: this._y };

		let opts = this.options;

		let scales  = this._scales;
		let d = this._domains;
		let r = this._ranges;

		for (let i in scales) {
			scales[i]
			.domain(d[i](this._data))
			.range(r[i](this._width(), this._height()))
		}

		return { x: this._x, y: this._y };
	},

	/**
	 * Calculates chart width.
	 */
	_width: function() {
		return this._chart._width;
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		return this._chart._height;
	},

	/*
	 * Finds data entries above a given y-elevation value and returns geo-coordinates
	 */
	_findCoordsForY: function(y) {
		let data = this._data;
		let z    = this._y.invert(y);

		// save indexes of elevation values above the horizontal line
		const list = data.reduce((array, item, index) => {
			if (item.z >= z) array.push(index);
			return array;
		}, []);

		let start = 0;
		let next;

		// split index list into blocks of coordinates
		const coords = list.reduce((array, _, curr) => {
			next = curr + 1;
			if (list[next] !== list[curr] + 1 || next === list.length) {
				array.push(
					list
					.slice(start, next)
					.map(i => data[i].latlng)
				);
				start = next;
			}
			return array;
		}, []);

		return coords;
	},

	/*
	 * Finds a data entry for a given x-coordinate of the diagram
	 */
	_findIndexForXCoord: function(x) {
		return d3
			.bisector(d => d[this.options.xAttr])
			.left(this._data || [0, 1], this._x.invert(x));
	},

	/*
	 * Finds a data entry for a given latlng of the map
	 */
	_findIndexForLatLng: function(latlng) {
		let result = null;
		let d      = Infinity;
		this._data.forEach((item, index) => {
			let dist = latlng.distanceTo(item.latlng);
			if (dist < d) {
				d = dist;
				result = index;
			}
		});
		return result;
	},

	/*
	 * Removes the drag rectangle and zoms back to the total extent of the data.
	 */
	_resetDrag: function() {
		if (this._chart.panes.brush.select(".selection").attr('width')) {
			this._chart.panes.brush.call(this._brush.clear);
			this._hideDiagramIndicator();
			this.fire('reset_drag');
		}
	},

	_resetZoom: function() {
		if (this._zoom) {
			this._zoom.transform(this._chart.svg, d3.zoomIdentity);
		}
	},

	/**
	 * Display distance and altitude level ("focus-rect").
	 */
	_showDiagramIndicator: function(item, xCoordinate) {
		let opts        = this.options;
		let yCoordinate = this._y(item[opts.yAttr]);

		this._focusG.attr("display", null);

		this._focusline.call(
			D3.MouseFocusLine({
				xCoord: xCoordinate,
				height: this._height()
			})
		);
		this._focuslabel.call(
			D3.MouseFocusLabel({
				xCoord: xCoordinate,
				yCoord: yCoordinate,
				height: this._height(),
				width : this._width(),
				labelX: d3.format("."+ opts.decimalsX +"f")(item[opts.xAttr]) + " " + this._xLabel,
				labelY: d3.format("."+ opts.decimalsY +"f")(item[opts.yAttr]) + " " + this._yLabel
			})
		);

		// this._focuslabel.selectAll('tspan').data(Object.values(this._focuslabels));

		let labels = this._props.focusLabels;
		let tooltip = this._focuslabel.select('text');
		let label;

		for (var i in labels) {
			label = tooltip.select(".mouse-focus-label-" + labels[i].name);

			if (!label.size()) {
				label   = tooltip.append("svg:tspan", ".mouse-focus-label-x")
					.attr("class", "mouse-focus-label-" + labels[i].name)
					.attr("dy", "1.5em");
			}

			label.text(typeof labels[i].value !== "function" ? labels[i].value : labels[i].value(item) );

			this._focuslabel.select('.mouse-focus-label-x')
				.attr("dy", "1.5em");
		}

	},

	_hideDiagramIndicator: function() {
		this._focusG.attr("display", 'none');
	},
});
