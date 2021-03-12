import 'leaflet-i18n';
import * as _  from './utils';
import * as D3 from './components';

export var Chart = L.Class.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	initialize: function(opts) {
		this.options = opts;

		this._data = [];
		this._draggingEnabled = opts.dragging;

		if (opts.imperial) {
			this._xLabel = "mi";
			this._yLabel = "ft";
		} else {
			this._xLabel = opts.xLabel;
			this._yLabel = opts.yLabel;
		}

		this._xTicks   = opts.xTicks;
		this._yTicks   = opts.yTicks;

		let chart  = this._chart = D3.Chart(opts);
		let scale  = this._updateScale();

		// SVG Container
		let svg   = this._container = chart.svg;

		// Panes
		this._grid  = chart.grid;
		this._area  = chart.area;
		this._point = chart.point;
		this._axis  = chart.axis;

		// Helpers
		svg.select('g')
			.call(this._appendFocusable())
			.call(this._appendLegend())
			.call(this._appendClipper())
			.call(this._appendCanvasPlot());

		this._context   = svg.select('.canvas-plot').node().getContext('2d');
		this._focus     = svg.select('.focus');
		this._focusRect = this._focus.select('rect');
		this._legend    = svg.select('.legend');
		this._x         = scale.x;
		this._y         = scale.y;

	},

	update: function(props) {
		if (props.data) this._data = props.data;
		if (props.options) this.options = props.options;

		// reset canvas profiles
		this._context.clearRect(0, 0, this._width(), this._height());

		// Reset chart profiles
		let chart = this;
		let paths = chart._paths;

		// chart._context.clearRect(0, 0, this._width(), this._height());
		// for (var i in paths) {
		// 	if (!paths[i].classed('leaflet-hidden')) {
		// 		if (paths[i].classed('canvas-path')) {
		// 			chart._drawCanvasPath(paths[i]);
		// 		}
		// 	}
		// }

		this._updateScale();

		// Reset chart axis.
		this._grid.selectAll('g').remove();
		this._axis.selectAll('g').remove();

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

	_updateScale: function() {
		if (this.zooming) return { x: this._x, y: this._y };

		let opts = this.options;

		this._scales = this._scales || {};

		this._scales.distance = {
			data       : this._data,
			range      : [0, this._width()],
			attr       : opts.xAttr,
			min        : opts.xAxisMin,
			max        : opts.xAxisMax,
			forceBounds: opts.forceAxisBounds,
		};

		this._scales.altitude = {
			data       : this._data,
			range      : [this._height(), 0],
			attr       : opts.yAttr,
			min        : opts.yAxisMin,
			max        : opts.yAxisMax,
			forceBounds: opts.forceAxisBounds,
		};

		this._x = D3.Scale(this._scales.distance);

		this._y = D3.Scale(this._scales.altitude);

		return { x: this._x, y: this._y };
	},


	_drawPath: function(name) {
		let opts = this.options;
		let ctx  = this._context;

		let path = this._paths[name];
		let area = this._areas[name];
		let node = path.node();

		area = L.extend(area, {
			width        : this._width(),
			height       : this._height(),
			scaleX       : this._x, //D3.Scale(this._scales.distance),
			scaleY       : D3.Scale(this._scales[name])
		});

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

			// stroke opacity
			ctx.globalAlpha = path.attr('fill-opacity') || 0.45;
			ctx.fill(p);

			ctx.globalAlpha = 1;

			ctx.closePath();
		} else /*if(!node.isConnected)*/ {
			this._area.append(() => node);
		}
	},

	_registerAxisGrid: function(props) {
		let opts = this.options;
		let grid = props;

		if (typeof grid !== 'function') {
			grid = L.extend({
				width     : this._width(),
				height    : this._height(),
				tickFormat: "",
			}, grid);
			grid = D3.Grid(grid);
		}

		this._grid.call(grid);

		return grid;
	},

	_registerAxisScale: function(props) {
		let opts  = this.options;
		let scale = props.scale;

		if (typeof scale !== 'function') {
			scale       = L.extend({
				data       : this._data,
				forceBounds: opts.forceAxisBounds
			}, scale);
			this._scales[props.name] = scale;
			scale       = D3.Scale(scale);
			props.scale = scale;
		}

		props      = L.extend({
			width  : this._width(),
			height : this._height(),
		}, props);

		let axis    = D3.Axis(props);

		this._axis.call(axis);

		return scale;
	},

	_registerAreaPath: function(props) {
		let opts = this.options;

		let path = D3.Path(props);

		// Save paths in memory for latter usage
		this._paths             = this._paths || {};
		this._paths[props.name] = path;

		this._areas             = this._areas || {};
		this._areas[props.name] = props;

		this._pathProps             = this._pathProps || {};
		this._pathProps[props.name] = props;

		this._drawPath(props.name);

		if (opts.legend) {
			this._legendItems = this._legendItems || {};
			this._legendItems[props.name] = D3.LegendItem({
				name   : props.name,
				label  : props.label,
				width  : this._width(),
				height : this._height(),
				margins: opts.margins,
				color: props.color
			});
		}

	},

	_registerFocusLabel: function(props) {
		if (!this._focuslabel)  return;

		this._focuslabels = this._focuslabels || {};
		let label         = this._focuslabels[props.name]

		if (!label || !label.property('isConnected')) {
			label           = this._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x")
				.attr("class", "mouse-focus-label-" + props.name)
				.attr("dy", "1.5em");
			this._focuslabels[props.name] = label;
		}

		label.text(props.value);

		this._focuslabel.select('.mouse-focus-label-x')
			.attr("dy", "1.5em");
	},

	_appendFocusable: function() {
		return g => {
			return g.append('g')
				.attr("class", 'focus')
				.call(this._appendFocusRect())
				.call(this._appendRuler())
				.call(this._appendMouseFocusG());
		};
	},

	/**
	 * Generate "mouse-focus" and "drag-rect".
	 */
	_appendFocusRect: function() {
		return g => {
			let container = this._container.node();
			let focusRect = g.append("rect")
				.call(
					D3.FocusRect({
						width : this._width(),
						height: this._height()
					})
				);

			if (L.Browser.mobile) {
				focusRect
					.on("touchstart.drag",    this._dragStartHandler.bind(this) )
					.on("touchmove.drag",     this._dragHandler.bind(this)      )
					.on("touchstart.focus",   this._mousemoveHandler.bind(this) )
					.on("touchmove.focus",    this._mousemoveHandler.bind(this) );
				_.on(container, 'touchend', this._dragEndHandler, this        )
			}

			focusRect
				.on("mousedown.drag",       this._dragStartHandler.bind(this) )
				.on("mousemove.drag",       this._dragHandler.bind(this)      )
				.on("mouseenter.focus",     this._mouseenterHandler.bind(this))
				.on("mousemove.focus",      this._mousemoveHandler.bind(this) )
				.on("mouseout.focus",       this._mouseoutHandler.bind(this)  );
			_.on(container, 'mouseup',    this._dragEndHandler, this        );

			return focusRect;
		};
	},

	/**
	 * Generate "mouse-focus".
	 */
	_appendMouseFocusG: function() {
		return g => {
			let focusG = this._focusG = g.append("g")
				.attr("class", "mouse-focus-group leaflet-hidden");

			this._focusline = focusG.append('svg:line')
				.call(
					D3.MouseFocusLine({
						xCoord: 0,
						height: this._height()
					})
				);
			this._focuslabel = focusG.append("g")
				.call(
					D3.MouseFocusLabel({
						xCoord: 0,
						yCoord: 0,
						height: this._height(),
						width : this._width(),
						labelX: "",
						labelY: "",
					})
				);
			return focusG;
		};
	},

	/**
	 * Generate "legend".
	 */
	_appendLegend: function() {
		return g => {
			// if (!this.options.legend) return;

			let legend = g.append('g')
				.attr("class", "legend");

			// this.fire("legend");

			// let items = legend.selectAll('.legend-item')
			// 	.on('click', (d, i) => {
			// 		let target = items.nodes()[i];
			// 		let name = target.getAttribute('data-name');
			// 		let path = this._area.select('path[data-name="' + name + '"]').node();
			// 		// this._fireEvt("elepath_toggle", { path: path, name: name, legend: target });
			// 	});

			return legend;
		};
	},

	/**
	 * d3-zoom
	 */
	_appendClipper: function() {
		let svg    = this._container;
		let area   = svg.select('.area');
		let margin = this.options.margins;

		const clip = this._clipPath = area.insert("clipPath", ":first-child") // generate and append <clipPath> element
			.attr("id", 'elevation-clipper');

		clip.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", this._width())
			.attr("height", this._height());

		let zoom = this._zoom = d3.zoom()
			.scaleExtent([1, 10])
			.extent([
				[margin.left, 0],
				[this._width() - margin.right, this._height()]
			])
			.translateExtent([
				[margin.left, -Infinity],
				[this._width() - margin.right, Infinity]
			])
			.filter((e) => e.shiftKey);

		zoom.on("start", (e) => {
				if (e.sourceEvent && e.sourceEvent.type == "mousedown") svg.style('cursor', 'grabbing');
				if (e.transform.k ==1 && e.transform.x == 0) {
					this._container.classed('zoomed', true);
				}
				this.zooming = true;
			})
			.on("end", (e) => {
				if (e.transform.k ==1 && e.transform.x == 0){
					this._container.classed('zoomed', false);
				}
				this.zooming = false;
				svg.style('cursor', '');
			})
			.on("zoom", (e) => {
				// TODO: find a faster way to redraw the chart.
				this.zooming = false;
				this._updateScale(); // hacky way for restoring x scale when zooming out
				this.zooming = true;
				this._x = e.transform.rescaleX(this._x); // calculate x scale at zoom level
				// control._updateChart();
				this._resetDrag();
				if (e.sourceEvent && e.sourceEvent.type == "mousemove") {
					this._hideDiagramIndicator();
				}
				this.fire('zoom');
			});
		// d3.select("body").on("keydown keyup", () => svg.style('cursor', e.shiftKey ? 'move' : '') );

		svg.call(zoom) // add zoom functionality to "svg" group
			.on("wheel", function(e) {
				if (e.shiftKey) e.preventDefault();
			});

		return g => g;
	},

	/**
	 * Init Canvas
	 */
	_appendCanvasPlot: function() {
		let svg    = this._container;
		let area   = svg.select('.area');

		const canvas = area.insert('svg:foreignObject'/*, ":first-child"*/) // generate and append <clipPath> element
			.attr('width', this._width())
			.attr('height', this._height())
		.append('xhtml:canvas')
			.attr('class', 'canvas-plot')
			.attr('width', this._width())
			.attr('height', this._height())

		return g => g;
	},

	/**
	 * Generate "ruler".
	 */
	_appendRuler: function() {

		const yMax      = this._height();
		const formatNum = d3.format(".0f");

		const dragstart = (e, d) => {
			this._hideDiagramIndicator();
			this._dragG.select(".horizontal-drag-label").text('');
		}

		const dragend = (e, d) => {
			let y = this._dragG.data()[0].y;
			if(y >= yMax || y <= 0) this._dragG.select(".horizontal-drag-label").text('');
		};

		const dragged = (e, d) => {
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

		return g => {
			if (!this.options.ruler) return g;

			this._dragG = g.append('g')
				.attr('class', 'horizontal-drag-group')
				.call(
					D3.Ruler({ height: this._height(), width: this._width() })
				)
				.call(
					d3.drag()
					.on("start", dragstart.bind(this))
					.on("drag", dragged.bind(this))
					.on("end", dragend.bind(this))
				);

			return g;
		};

	},

	/**
	 * Add a waypoint of interest over the chart
	 */
	_addCheckpoint:function(point) {
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

			point.item = this._point.append('g')
				.attr("class", "point " + point.position)
				.attr("transform", "translate(" + x + "," + y + ")");

			let line = point.item
				.append("svg:line")
				.attr("y1", 0)
				.attr("x1", 0)
				.attr("y2", ({'top': -y, 'bottom': this._height() - y})[point.position])
				.attr("x2", ({'left': -x, 'right': this._width() - x})[point.position] || 0)
				.attr("style","stroke: rgb(51, 51, 51); stroke-width: 0.5; stroke-dasharray: 2, 2;");

				point.item
					.append("svg:circle")
					.attr("class", " height-focus circle-lower")
					.attr("r", 3);

				if (point.label) {
					point.item
						.append("svg:text")
						.attr("dx", "4px")
						.attr("dy", "-4px")
						.text(point.label);
				}
		}

	},

	/**
	 * Calculates chart width.
	 */
	_width: function() {
		return this._chart._width;
		// let opts = this.options;
		// return opts.width - opts.margins.left - opts.margins.right;
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		return this._chart._height;
		// let opts = this.options;
		// return opts.height - opts.margins.top - opts.margins.bottom;
	},

	/*
	 * Handle drag operations.
	 */
	_dragHandler: function(e) {
		//we don't want map events to occur here
		e.preventDefault();
		e.stopPropagation();

		this._gotDragged = true;
		this._drawDragRectangle(e);
	},

	/*
	 * Handles start of drag operations.
	 */
	_dragStartHandler: function(e) {
		if (e.shiftKey) return;

		e.preventDefault();
		e.stopPropagation();

		this._gotDragged = false;
		this._dragStartCoords = d3.pointer(e, this._focusRect.node());
	},

	/*
	 * Draws the currently dragged rectangle over the chart.
	 */
	_drawDragRectangle: function(e) {
		if (!this._dragStartCoords || !this._draggingEnabled) return;

		if (!this._dragRectangle) {
			this._dragRectangle = this._focus.insert("rect", ".mouse-focus-group")
				.attr('class', 'mouse-drag')
				.style("pointer-events", "none");
		}

		this._dragCurrentCoords = d3.pointer(e, this._focusRect.node());

		this._dragRectangle.call(
			D3.DragRectangle({
				dragStartCoords: this._dragStartCoords,
				dragEndCoords  : this._dragCurrentCoords,
				height         : this._height(),
			})
		);
	},

	/*
	 * Handles end of drag operations. Zooms the map to the selected items extent.
	 */
	_dragEndHandler: function(e) {
		if (!this._dragStartCoords || !this._dragCurrentCoords || !this._gotDragged) {
			this._dragStartCoords = null;
			this._gotDragged      = false;
			if (this._draggingEnabled) this._resetDrag();
			return;
		}

		let start = this._findIndexForXCoord(this._dragStartCoords[0]);
		let end   = this._findIndexForXCoord(this._dragCurrentCoords[0]);

		if (start == end) return;

		this._dragStartCoords = null;
		this._gotDragged      = false;

		this.fire('dragged', { dragstart: this._data[start], dragend: this._data[end] });
	},

	/*
	 * Handles the moueseenter over the chart.
	 */
	_mouseenterHandler: function() {
		this.fire("mouse_enter");
	},

	/*
	 * Handles the moueseover the chart and displays distance and altitude level.
	 */
	_mousemoveHandler: function(e, d, i, ctx) {
		let coords = d3.pointer(e, this._focusRect.node());
		let xCoord = coords[0];
		let item   = this._data[this._findIndexForXCoord(xCoord)];

		this.fire("mouse_move", { item: item, xCoord: xCoord });
	},

	/*
	 * Handles the moueseout over the chart.
	 */
	_mouseoutHandler: function(e) {
		this.fire("mouse_out");
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
		if (this._dragRectangle) {
			this._dragRectangle.remove();
			this._dragRectangle = null;
			this._hideDiagramIndicator();
			this.fire('reset_drag');
		}
	},

	/**
	 * Display distance and altitude level ("focus-rect").
	 */
	_showDiagramIndicator: function(item, xCoordinate) {
		// if (!this._chartEnabled) return;

		let opts        = this.options;
		let yCoordinate = this._y(item[opts.yAttr]);

		this._focusG.classed("leaflet-hidden", false);

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
	},

	_hideDiagramIndicator: function() {
		this._focusG.classed("leaflet-hidden", true);
	},
});

// Chart.addInitHook(function() {
// 	this.on('mouse_move', function(e) {
// 		if (e.item) this._showDiagramIndicator(e.item, e.xCoord);
// 	});
//
// });
