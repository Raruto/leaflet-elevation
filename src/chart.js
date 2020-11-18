import 'leaflet-i18n';
import * as _ from './utils';
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

		this._xTicks = opts.xTicks;
		this._yTicks = opts.yTicks;

		let scale = this._updateScale();

		let svg = this._container = d3.create("svg")
			.attr("class", "background")
			.attr("width", opts.width)
			.attr("height", opts.height);

		let g = svg
			.append("g")
			.attr("transform", "translate(" + opts.margins.left + "," + opts.margins.top + ")")
			.call(this._appendGrid())
			.call(this._appendArea())
			.call(this._appendAxis())
			.call(this._appendFocusable())
			.call(this._appendLegend())
			.call(this._appendClipper());

		this._grid = svg.select('.grid');
		this._area = svg.select('.area');
		this._path = svg.select('.area path');
		this._axis = svg.select('.axis');
		this._focus = svg.select('.focus');
		this._focusRect = this._focus.select('rect');
		this._legend = svg.select('.legend');
		this._x = scale.x;
		this._y = scale.y;
	},

	update: function(props) {
		if (props.data) this._data = props.data;
		if (props.options) this.options = props.options;

		this._updateScale();
		this._updateAxis();
		this._updateArea();

		return this;
	},

	render: function() {
		return container => container.append(() => this._container.node());
	},

	clear: function() {
		this._resetDrag();
		this._area.selectAll('path').attr("d", "M0 0");
		if (this._path) {
			// this._x.domain([0, 1]);
			// this._y.domain([0, 1]);
			// this._updateAxis();
		}
	},

	_updateScale: function() {
		if (this.zooming) return { x: this._x, y: this._y };

		let opts = this.options;

		this._x = D3.Scale({
			data: this._data,
			range: [0, this._width()],
			attr: opts.xAttr,
			min: opts.xAxisMin,
			max: opts.xAxisMax,
			forceBounds: opts.forceAxisBounds,
		});

		this._y = D3.Scale({
			data: this._data,
			range: [this._height(), 0],
			attr: opts.yAttr,
			min: opts.yAxisMin,
			max: opts.yAxisMax,
			forceBounds: opts.forceAxisBounds,
		});

		return { x: this._x, y: this._y };
	},

	/**
	 * Update chart axis.
	 */
	_updateAxis: function() {
		this._grid.selectAll('g').remove();
		this._axis.selectAll('g').remove();
		this._grid
			.call(this._appendXGrid())
			.call(this._appendYGrid());
		this._axis
			.call(this._appendXaxis())
			.call(this._appendYaxis());

		// this.fire('axis_updated');
	},

	_updateArea: function() {
		let opts = this.options;
		this._path
			.call(
				D3.Area({
					interpolation: opts.interpolation,
					data: this._data,
					name: 'Altitude',
					xAttr: opts.xAttr,
					yAttr: opts.yAttr,
					width: this._width(),
					height: this._height(),
					scaleX: this._x,
					scaleY: this._y,
				})
			);
	},

	/**
	 * Generate "grid".
	 */
	_appendGrid: function() {
		return g =>
			g.append("g")
			.attr("class", "grid")
			.call(this._appendXGrid())
			.call(this._appendYGrid());
	},

	/**
	 * Generate "x-grid".
	 */
	_appendXGrid: function() {
		return D3.Grid({
			axis: "x",
			position: "bottom",
			width: this._width(),
			height: this._height(),
			scale: this._x,
			ticks: this._xTicks,
			tickFormat: "",
		});
	},

	/**
	 * Generate "y-grid".
	 */
	_appendYGrid: function() {
		return D3.Grid({
			axis: "y",
			position: "left",
			width: this._width(),
			height: this._height(),
			scale: this._y,
			ticks: this.options.yTicks,
			tickFormat: "",
		});
	},

	/**
	 * Generate "axis".
	 */
	_appendAxis: function() {
		return g =>
			g.append("g")
			.attr("class", "axis")
			.call(this._appendXaxis())
			.call(this._appendYaxis());
	},

	/**
	 * Generate "x-axis".
	 */
	_appendXaxis: function() {
		return D3.Axis({
			axis: "x",
			position: "bottom",
			width: this._width(),
			height: this._height(),
			scale: this._x,
			ticks: this._xTicks,
			label: this._xLabel,
			labelY: 25,
			labelX: this._width() + 6,
		});
	},

	/**
	 * Generate "y-axis".
	 */
	_appendYaxis: function() {
		return D3.Axis({
			axis: "y",
			position: "left",
			width: this._width(),
			height: this._height(),
			scale: this._y,
			ticks: this.options.yTicks,
			label: this._yLabel,
			labelX: -25,
			labelY: 3,
		});
	},

	/**
	 * Generate "path".
	 */
	_appendArea: function() {
		return g => g.append('g')
			.attr("class", "area")
			.append('path');
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
			let focusRect = g.append("rect")
				.call(
					D3.FocusRect({
						width: this._width(),
						height: this._height()
					})
				);

			if (L.Browser.mobile) {
				focusRect
					.on("touchstart.drag", this._dragStartHandler.bind(this))
					.on("touchmove.drag", this._dragHandler.bind(this))
					.on("touchstart.focus", this._mousemoveHandler.bind(this))
					.on("touchmove.focus", this._mousemoveHandler.bind(this));
				L.DomEvent.on(this._container.node(), 'touchend', this._dragEndHandler, this);
			}

			focusRect
				.on("mousedown.drag", this._dragStartHandler.bind(this))
				.on("mousemove.drag", this._dragHandler.bind(this))
				.on("mouseenter.focus", this._mouseenterHandler.bind(this))
				.on("mousemove.focus", this._mousemoveHandler.bind(this))
				.on("mouseout.focus", this._mouseoutHandler.bind(this));
			L.DomEvent.on(this._container.node(), 'mouseup', this._dragEndHandler, this);

			return focusRect;
		};
	},

	/**
	 * Generate "mouse-focus".
	 */
	_appendMouseFocusG: function() {
		return g => {
			let focusG = this._focusG = g.append("g")
				.attr("class", "mouse-focus-group hidden");

			this._focusline = focusG.append('svg:line')
				.call(
					D3.MouseFocusLine({
						xCoord: 0,
						height: this._height()
					})
				);;
			this._focuslabel = focusG.append("g")
				.call(
					D3.MouseFocusLabel({
						xCoord: 0,
						yCoord: 0,
						height: this._height(),
						width: this._width(),
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
		let svg = this._container;
		let area = svg.select('.area');
		let margin = this.options.margins;

		const clip = this._clipPath = area.insert("clipPath", ":first-child") // generate and append <clipPath> element
			.attr("id", 'elevation-clipper');
		clip.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", this._width())
			.attr("height", this._height());

		let zoom = d3.zoom()
			.scaleExtent([1, 10])
			.extent([
				[margin.left, 0],
				[this._width() - margin.right, this._height()]
			])
			.translateExtent([
				[margin.left, -Infinity],
				[this._width() - margin.right, Infinity]
			])
			.filter(() => d3.event.ctrlKey);

		zoom.on("start", (e) => {
				if (d3.event.sourceEvent.type == "mousedown") svg.style('cursor', 'grabbing');
				this.zooming = true;
			})
			.on("end", (e) => {
				this.zooming = false;
				svg.style('cursor', '');
			})
			.on("zoom", (e) => {
				// TODO: find a faster way to redraw the chart.
				this.zooming = false;
				this._updateScale(); // hacky way for restoring x scale when zooming out
				this.zooming = true;
				this._x = d3.event.transform.rescaleX(this._x); // calculate x scale at zoom level
				// this._updateAxis();
				// this._updateArea();
				// control._updateChart();
				this._resetDrag();
				if (d3.event.sourceEvent.type == "mousemove") {
					this._hideDiagramIndicator();
				}
				this.fire('zoom');
			});
		// d3.select("body").on("keydown keyup", () => svg.style('cursor', d3.event.ctrlKey ? 'move' : '') );

		svg.call(zoom) // add zoom functionality to "svg" group
			.on("wheel", function() {
				if (d3.event.ctrlKey) d3.event.preventDefault();
			});

		return g => g;
	},

	/**
	 * Generate "ruler".
	 */
	_appendRuler: function() {
		const dragstart = function(d) {
			this._hideDiagramIndicator();
			this._container.select(".horizontal-drag-label").classed('hidden', false);
		}

		const dragend = function(d) {
			let y = this._container.select('.horizontal-drag-group').node().transform.baseVal.consolidate().matrix.f;
			this._container.select(".horizontal-drag-label").classed('hidden', y >= this._height() || y <= 0)
		};

		const dragged = function(d) {
			let yMax = this._height();
			let yCoord = d3.mouse(this._container.node())[1];
			let y = yCoord > 0 ? (yCoord < yMax ? yCoord : yMax) : 0;
			let z = this._y.invert(y);
			let formatNum = d3.format(".0f");

			this._container.select(".horizontal-drag-group")
				.attr("transform", d => "translate(" + d.x + "," + y + ")")
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
	 * Calculates chart width.
	 */
	_width: function() {
		let opts = this.options;
		return opts.width - opts.margins.left - opts.margins.right;
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		let opts = this.options;
		return opts.height - opts.margins.top - opts.margins.bottom;
	},

	/*
	 * Handle drag operations.
	 */
	_dragHandler: function() {
		//we don't want map events to occur here
		d3.event.preventDefault();
		d3.event.stopPropagation();

		this._gotDragged = true;
		this._drawDragRectangle();
	},

	/*
	 * Handles start of drag operations.
	 */
	_dragStartHandler: function() {
		if (d3.event.ctrlKey) return;

		d3.event.preventDefault();
		d3.event.stopPropagation();

		this._gotDragged = false;
		this._dragStartCoords = d3.mouse(this._focusRect.node());
	},

	/*
	 * Draws the currently dragged rectangle over the chart.
	 */
	_drawDragRectangle: function() {
		if (!this._dragStartCoords || !this._draggingEnabled) return;
		if (!this._dragRectangle) {
			this._dragRectangle = this._focus.insert("rect", ".mouse-focus-group")
				.attr('class', 'mouse-drag')
				.style("pointer-events", "none");
		}
		this._dragRectangle.call(
			D3.DragRectangle({
				dragStartCoords: this._dragStartCoords,
				dragEndCoords: this._dragCurrentCoords = d3.mouse(this._focusRect.node()),
				height: this._height(),
			})
		);
	},

	/*
	 * Handles end of drag operations. Zooms the map to the selected items extent.
	 */
	_dragEndHandler: function() {
		if (!this._dragStartCoords || !this._dragCurrentCoords || !this._gotDragged) {
			this._dragStartCoords = null;
			this._gotDragged = false;
			if (this._draggingEnabled) this._resetDrag();
			return;
		}

		let start = this._findIndexForXCoord(this._dragStartCoords[0]);
		let end = this._findIndexForXCoord(this._dragCurrentCoords[0]);

		if (start == end) return;

		this._dragStartCoords = null;
		this._gotDragged = false;

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
	_mousemoveHandler: function(d, i, ctx) {
		let coords = d3.mouse(this._focusRect.node());
		let xCoord = coords[0];
		let item = this._data[this._findIndexForXCoord(xCoord)];

		this.fire("mouse_move", { item: item, xCoord: xCoord });
	},

	/*
	 * Handles the moueseout over the chart.
	 */
	_mouseoutHandler: function() {
		this.fire("mouse_out");
	},

	/*
	 * Finds data entries above a given y-elevation value and returns geo-coordinates
	 */
	_findCoordsForY: function(y) {
		let data = this._data;
		let z = this._y.invert(y);

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
		let d = Infinity;
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

		let opts = this.options;
		let yCoordinate = this._y(item[opts.yAttr]);

		this._focusG.classed("hidden", false);

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
				width: this._width(),
				labelX: _.formatNum(item[opts.xAttr], opts.decimalsX) + " " + this._xLabel,
				labelY: _.formatNum(item[opts.yAttr], opts.decimalsY) + " " + this._yLabel,
			})
		);
	},

	_hideDiagramIndicator: function() {
		this._focusG.classed("hidden", true);
	},
});

// Chart.addInitHook(function() {
// 	this.on('mouse_move', function(e) {
// 		if (e.item) this._showDiagramIndicator(e.item, e.xCoord);
// 	});
//
// });
