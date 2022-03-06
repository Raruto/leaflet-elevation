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
			scales      : {},
			paths       : {},
			areas       : {},
			grids       : {},
			axes        : {},
			legendItems : {},
			tooltipItems: {},
		};

		this._scales       = {};
		this._domains      = {};
		this._ranges       = {};
		this._paths        = {};

		this._brushEnabled = opts.dragging;
		this._zoomEnabled  = opts.zooming;

		let chart       = this._chart = D3.Chart(opts);

		// SVG Container
		let svg         = this._container = chart.svg;

		// Panes
		this._grid      = chart.pane('grid');
		this._area      = chart.pane('area');
		this._point     = chart.pane('point');
		this._axis      = chart.pane('axis');
		this._legend    = chart.pane('legend');
		this._tooltip   = chart.pane('tooltip');
		this._ruler     = chart.pane('ruler');

		// Scales
		this._initScale();

		// Helpers
		this._mask  = chart.get('mask');
		this._context   = chart.get('context');
		this._brush     = chart.get('brush');

		this._zoom = d3.zoom();
		this._drag = d3.drag();

		// Interactions
		this._initInteractions();

		// svg.on('resize', (e)=>console.log(e.detail));

		// Handle multi-track segments (BETA)
		this._maskGaps = [];
		control.on('eletrack_added', (e) => {
			this._maskGaps.push(e.index);
			control.once('eledata_updated', (e) => this._maskGaps.push(e.index));
		});

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
		this._hideDiagramIndicator()
		this._area.selectAll('path').attr("d", "M0 0");
		this._context.clearRect(0, 0, this._width(), this._height());

		// if (this._path) {
			// this._x.domain([0, 1]);
			// this._y.domain([0, 1]);
		// }

		this._maskGaps = [];
		this._mask.selectAll(".gap").remove();
	},

	_drawPath: function(name) {
		let path   = this._paths[name];
		let area   = this._props.areas[name];

		path.datum(this._data).attr("d",
			D3.Area(
				L.extend({}, area, {
					width        : this._width(),
					height       : this._height(),
					scaleX       : this._scales[area.scaleX],
					scaleY       : this._scales[area.scaleY]
				})
			)
		);

		if (path.classed('leaflet-hidden')) return;

		if (this.options.preferCanvas) {
			_.drawCanvas(this._context, path);
		} else {
			this._area.append(() => path.node());
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
			if (!this._data.length) return;
			let extent  = e.selection;
			if (extent) {
				let start = this._findIndexForXCoord(extent[0]);
				let end   = this._findIndexForXCoord(extent[1]);
				this.fire('dragged', { dragstart: this._data[start], dragend: this._data[end] });
			}
		}

		const focus   = (e) => {
			if (!this._data.length) return;
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
				// Apply d3-zoom (bind <clipPath> mask)
				if (this._mask) {
					this._point.attr('mask', 'url(#' + this._mask.attr('id') + ')');
				}
			}
			this.zooming = true;
		};

		const onEnd  = (e) => {
			if (e.transform.k ==1 && e.transform.x == 0){
				this._container.classed('zoomed', false);
				// Apply d3-zoom (bind <clipPath> mask)
				if (this._mask) {
					this._point.attr('mask', null);
				}
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
			if (this._scales.time) this._scales.time = e.transform.rescaleX(this._scales.time); // calculate x scale at zoom level
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
			let y         = this._ruler.data()[0].y;
			if (y >= yMax || y <= 0) this._ruler.select(".horizontal-drag-label").text('');
			this._hideDiagramIndicator();
		};

		const position  = (e, d) => {
			let yMax      = this._height();
			let yCoord    = d3.pointers(e, this._area.node())[0][1];
			let y         = yCoord > 0 ? (yCoord < yMax ? yCoord : yMax) : 0;
			let z         = this._y.invert(y);
			let data      = L.extend(this._ruler.data()[0], { y: y });

			this._ruler
				.data([data])
				.attr("transform", d => "translate(" + d.x + "," + d.y + ")")
				.classed('active', y < yMax);

			this._container.select(".horizontal-drag-label")
				.text(formatNum(z) + " " + (this.options.imperial ? 'ft' : 'm'));

			this.fire('ruler_filter', { coords: yCoord < yMax && yCoord > 0 ? this._findCoordsForY(yCoord) : [] });
		}

		drag
		.on("start end", label)
		.on("drag", position);

		this._ruler.call(drag);

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
		if (props.scale == 'y') props.scale = this._y;
		else if (props.scale == 'x') props.scale = this._x;

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
		if (props.scale == 'y') props.scale = this._y;
		else if(props.scale == 'x') props.scale = this._x;

		this._props.grids[props.name || props.axis] = props;
	},

	_registerAxisScale: function(props) {
		if (props.scale == 'y') props.scale = this._y;
		else if(props.scale == 'x') props.scale = this._x;

		let opts  = this.options;
		let scale = props.scale;

		if (typeof this._scales[props.name] === 'function') {
			props.scale = this._scales[props.name]; // retrieve cached scale
		} else if (typeof scale !== 'function') {
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
	 * Add a point of interest over the chart
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
		} 

		this._point.call(D3.CheckPoint({
			point: point,
			width: this._width(),
			height: this._height(),
			x: x,
			y: y,
		}));
	},

	_registerTooltip: function(props) {
		props.order = props.order ?? 100;
		this._props.tooltipItems[props.name] = props;
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

		// Apply svg mask on multi-track segments (BETA)
		this._mask.selectAll(".gap").remove()
		this._maskGaps.forEach((d, i) => {
			if(i >= this._maskGaps.length - 2) return;
			let d1 = this._data[this._maskGaps[i]];
			let d2 = this._data[this._maskGaps[i + 1]];
			let x1 = this._x(this._data[this._findIndexForLatLng(d1.latlng)].dist);
			let x2 = this._x(this._data[this._findIndexForLatLng(d2.latlng)].dist);
			this._mask
				.append("rect")
				.attr("x", x1)
				.attr("y", 0)
				.attr("width", x2 - x1 )
				.attr("height", this._height())
				.attr('class', 'gap')
				.attr('fill-opacity', '0.8')
				.attr("fill", 'black');  // black = hide
		});
	},

	_updateLegend: function () {

		if (this.options.legend === false) return;

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
		let marginB = 30 + (xAxesB * 2);
		let marginR = n * 30;

		// Adjust chart right margins
		if (n && this.options.margins.right < marginR) {
			this.options.margins.right  = marginR;
			this.fire('margins_updated');
		}

		// Adjust chart bottom margins
		if(xAxesB && this.options.margins.bottom < marginB) {
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
				if (this._mask) {
					path.attr('mask', 'url(#' + this._mask.attr('id') + ')');
				}

			});
	},

	_updateScale: function() {
		if (this.zooming) return { x: this._x, y: this._y };

		for (let i in this._scales) {
			this._scales[i]
				.domain(this._domains[i](this._data))
				.range(this._ranges[i](this._width(), this._height()))
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
		this._tooltip
			.attr("display", null)
			.call(D3.Tooltip({
				xCoord: xCoordinate,
				yCoord: this._y(item[this.options.yAttr]),
				height: this._height(),
				width : this._width(),
				labels: this._props.tooltipItems,
				item: item
			}));
	},

	_hideDiagramIndicator: function() {
		this._tooltip.attr("display", 'none');
	},
});
