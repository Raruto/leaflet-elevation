/*
 * Copyright (c) 2019, GPL-3.0+ Project, Raruto
 *
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or (at your
 *  option) any later version.
 *
 *  This file is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see .
 *
 * This file incorporates work covered by the following copyright and
 * permission notice:
 *
 *     Copyright (c) 2013-2016, MIT License, Felix “MrMufflon” Bache
 *
 *     Permission to use, copy, modify, and/or distribute this software
 *     for any purpose with or without fee is hereby granted, provided
 *     that the above copyright notice and this permission notice appear
 *     in all copies.
 *
 *     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
 *     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
 *     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
 *     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
 *     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 *     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 *     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 *     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';

var Elevation = L.Control.Elevation = L.Control.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	options: {
		autohide: !L.Browser.mobile,
		autohideMarker: true,
		collapsed: false,
		controlButton: {
			iconCssClass: "elevation-toggle-icon",
			title: "Elevation"
		},
		detached: true,
		distanceFactor: 1,
		dragging: !L.Browser.mobile,
		downloadLink: 'link',
		elevationDiv: "#elevation-div",
		followMarker: true,
		forceAxisBounds: false,
		gpxOptions: {
			async: true,
			marker_options: {
				startIconUrl: null,
				endIconUrl: null,
				shadowUrl: null,
				wptIcons: {
					'': L.divIcon({
						className: 'elevation-waypoint-marker',
						html: '<i class="elevation-waypoint-icon"></i>',
						iconSize: [30, 30],
						iconAnchor: [8, 30],
					})
				},
			},
		},
		height: 200,
		heightFactor: 1,
		hoverNumber: {
			decimalsX: 2,
			decimalsY: 0,
			formatter: _.formatter,
		},
		imperial: false,
		interpolation: "curveLinear",
		lazyLoadJS: true,
		legend: true,
		loadData: {
			defer: false,
			lazy: false,
		},
		marker: 'elevation-line',
		markerIcon: L.divIcon({
			className: 'elevation-position-marker',
			html: '<i class="elevation-position-icon"></i>',
			iconSize: [32, 32],
			iconAnchor: [16, 16],
		}),
		placeholder: false,
		position: "topright",
		polyline: {
			className: 'elevation-polyline',
			color: '#000',
			opacity: 0.75,
			weight: 5,
			lineCap: 'round'
		},
		reverseCoords: false,
		skipNullZCoords: false,
		theme: "lightblue-theme",
		margins: {
			top: 10,
			right: 20,
			bottom: 30,
			left: 50
		},
		responsive: true,
		summary: 'inline',
		width: 600,
		xAttr: "dist",
		xLabel: "km",
		xTicks: undefined,
		yAttr: "z",
		yAxisMax: undefined,
		yAxisMin: undefined,
		yLabel: "m",
		yTicks: undefined,
		zFollow: 13,
	},
	__mileFactor: 0.621371,
	__footFactor: 3.28084,

	/*
	 * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
	 */
	addData: function(d, layer) {
		if ((typeof layer === "undefined" || layer === null) && d.on) {
			layer = d;
		}
		Elevation._d3LazyLoader = _.lazyLoader(
			'https://unpkg.com/d3@5.15.0/dist/d3.min.js',
			typeof d3 !== 'object' || !this.options.lazyLoadJS,
			Elevation._d3LazyLoader
		).then(() => {
			this._addData(d);
			this._addLayer(layer);
			this._fireEvt("eledata_added", { data: d, layer: layer, track_info: this.track_info }, true);
		});
	},

	/**
	 * Adds the control to the given map.
	 */
	addTo: function(map) {
		if (this.options.detached) {
			this._appendElevationDiv(map._container).appendChild(this.onAdd(map));
		} else {
			L.Control.prototype.addTo.call(this, map);
		}
		return this;
	},

	/*
	 * Reset data and display
	 */
	clear: function() {
		this._clearPath();
		this._clearChart();
		this._clearData();

		this._fireEvt("eledata_clear");
	},

	/**
	 * Disable dragging chart on touch events.
	 */
	disableDragging: function() {
		this._draggingEnabled = false;
		this._resetDrag();
	},

	/**
	 * Enable dragging chart on touch events.
	 */
	enableDragging: function() {
		this._draggingEnabled = true;
	},

	/**
	 * Sets a map view that contains the given geographical bounds.
	 */
	fitBounds: function(bounds) {
		bounds = bounds || this._fullExtent;
		if (this._map && bounds) this._map.fitBounds(bounds);
	},

	/**
	 * Get default zoom level when "followMarker" is true.
	 */
	getZFollow: function() {
		return this._zFollow;
	},

	/**
	 * Hide current elevation chart profile.
	 */
	hide: function() {
		this._container.style.display = "none";
	},

	/**
	 * Initialize chart control "options" and "container".
	 */
	initialize: function(options) {
		this.options = _.deepMerge({}, this.options, options);

		if (this.options.imperial) {
			this._distanceFactor = this.__mileFactor;
			this._heightFactor = this.__footFactor;
			this._xLabel = "mi";
			this._yLabel = "ft";
		} else {
			this._distanceFactor = this.options.distanceFactor;
			this._heightFactor = this.options.heightFactor;
			this._xLabel = this.options.xLabel;
			this._yLabel = this.options.yLabel;
		}

		this._chartEnabled = true;
		this._draggingEnabled = this.options.dragging;
		this._zFollow = this.options.zFollow;

		if (this.options.followMarker) this._setMapView = L.Util.throttle(this._setMapView, 300, this);
		if (this.options.placeholder) this.options.loadData.lazy = this.options.loadData.defer = true;
	},

	/**
	 * Alias for loadData
	 */
	load: function(data, opts) {
		this.loadData(data, opts);
	},

	/**
	 * Alias for addTo
	 */
	loadChart: function(map) {
		this.addTo(map);
	},

	/**
	 * Load elevation data (GPX or GeoJSON).
	 */
	loadData: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		if (opts.defer) {
			this.loadDefer(data, opts);
		} else if (opts.lazy) {
			this.loadLazy(data, opts);
		} else if (_.isXMLDoc(data)) {
			this.loadGPX(data);
		} else if (_.isJSONDoc(data)) {
			this.loadGeoJSON(data);
		} else {
			this.loadFile(data);
		}
	},

	/**
	 * Wait for document load before download data.
	 */
	loadDefer: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		opts.defer = false;
		_.deferFunc(L.bind(this.loadData, this, data, opts));
	},

	/**
	 * Load data from a remote url.
	 */
	loadFile: function(url) {
		_.loadFile(url)
			.then((data) => {
				this._downloadURL = url; // TODO: handle multiple urls?
				this.loadData(data, { lazy: false, defer: false });
			})
			.catch((err) => console.warn(err));
	},

	/**
	 * Load raw GeoJSON data.
	 */
	loadGeoJSON: function(data) {
		_.GeoJSONLoader(data, this);
	},

	/**
	 * Load raw GPX data.
	 */
	loadGPX: function(data) {
		Elevation._gpxLazyLoader = _.lazyLoader(
			'https://unpkg.com/leaflet-gpx@1.5.0/gpx.js',
			typeof L.GPX !== 'function' || !this.options.lazyLoadJS,
			Elevation._gpxLazyLoader
		).then(() => {
			_.GPXLoader(data, this);
		});
	},

	/**
	 * Wait for chart container visible before download data.
	 */
	loadLazy: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		let elem = opts.lazy.parentNode ? opts.lazy : this.placeholder;
		_.waitHolder(opts.lazy)
			.then(() => {
				opts.lazy = false;
				this.loadData(data, opts)
				this.once('eledata_loaded', () => opts.lazy.parentNode.removeChild(elem));
			});
	},

	/**
	 * Create container DOM element and related event listeners.
	 * Called on control.addTo(map).
	 */
	onAdd: function(map) {
		this._map = map;

		let container = this._container = L.DomUtil.create("div", "elevation-control elevation");

		if (!this.options.detached) {
			L.DomUtil.addClass(container, 'leaflet-control');
		}

		if (this.options.theme) {
			L.DomUtil.addClass(container, this.options.theme); // append theme to control
		}

		if (this.options.placeholder && !this._data) {
			this.placeholder = L.DomUtil.create('img', 'elevation-placeholder');
			if (typeof this.options.placeholder === 'string') {
				this.placeholder.src = this.options.placeholder;
				this.placeholder.alt = '';
			} else {
				for (let i in this.options.placeholder) { this.placeholder.setAttribute(i, this.options.placeholder[i]); }
			}
			container.insertBefore(this.placeholder, container.firstChild);
		}

		if (!map.getPane('elevationPane')) {
			let pane = map.createPane('elevationPane');
			pane.style.zIndex = 625; // This pane is above markers but below popups.
			pane.style.pointerEvents = 'none';
		}

		Elevation._d3LazyLoader = _.lazyLoader(
			'https://unpkg.com/d3@5.15.0/dist/d3.min.js',
			typeof d3 !== 'object' || !this.options.lazyLoadJS,
			Elevation._d3LazyLoader
		).then(() => {
			this._initToggle(container);
			this._initChart(container);

			this._map.on('zoom viewreset zoomanim', this._hidePositionMarker, this);
			this._map.on('resize', this._resetView, this);
			this._map.on('resize', this._resizeChart, this);
			this._map.on('mousedown', this._resetDrag, this);

			L.DomEvent.on(this._map._container, 'mousewheel', this._resetDrag, this);
			L.DomEvent.on(this._map._container, 'touchstart', this._resetDrag, this);

			this.on('eledata_added', this._updateChart, this);
			this.on('eledata_added', this._updateSummary, this);

			this._updateChart();
			this._updateSummary();
		});

		return container;
	},

	/**
	 * Clean up control code and related event listeners.
	 * Called on control.remove().
	 */
	onRemove: function(map) {
		this._container = null;

		this._map.off('zoom viewreset zoomanim', this._hidePositionMarker, this);
		this._map.off('resize', this._resetView, this);
		this._map.off('resize', this._resizeChart, this);
		this._map.off('mousedown', this._resetDrag, this);

		L.DomEvent.off(this._map._container, 'mousewheel', this._resetDrag, this);
		L.DomEvent.off(this._map._container, 'touchstart', this._resetDrag, this);

		this.off('eledata_added', this._updateChart, this);
		this.off('eledata_added', this._updateSummary, this);
	},

	/**
	 * Redraws the chart control. Sometimes useful after screen resize.
	 */
	redraw: function() {
		this._resizeChart();
	},

	/**
	 * Set default zoom level when "followMarker" is true.
	 */
	setZFollow: function(zoom) {
		this._zFollow = zoom;
	},

	/**
	 * Hide current elevation chart profile.
	 */
	show: function() {
		this._container.style.display = "block";
	},

	/*
	 * Parsing data either from GPX or GeoJSON and update the diagram data
	 */
	_addData: function(d) {
		let geom = d && d.geometry;
		let feat = d && d.type === "FeatureCollection";
		let gpx = d && d._latlngs;

		if (geom) {
			switch (geom.type) {
				case 'LineString':
					this._addGeoJSONData(geom.coordinates);
					break;

				case 'MultiLineString':
					geom.coordinates.forEach(coords => this._addGeoJSONData(coords));
					break;

				default:
					console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
			}
		}

		if (feat) {
			d.features.forEach(feature => this._addData(feature));
		}

		if (gpx) {
			this._addGPXdata(d._latlngs);
		}
	},

	/*
	 * Parsing of GeoJSON data lines and their elevation in z-coordinate
	 */
	_addGeoJSONData: function(coords) {
		if (coords) {
			coords.forEach(point => this._addPoint(point[1], point[0], point[2]));
		}
	},

	/*
	 * Parsing function for GPX data and their elevation in z-coordinate
	 */
	_addGPXdata: function(coords) {
		if (coords) {
			coords.forEach(point => this._addPoint(point.lat, point.lng, point.meta.ele));
		}
	},

	/*
	 * Parse and push a single (x, y, z) point to current elevation profile.
	 */
	_addPoint: function(x, y, z) {
		if (this.options.reverseCoords) {
			[x, y] = [y, x];
		}

		let data = this._data || [];
		let eleMax = this._maxElevation || -Infinity;
		let eleMin = this._minElevation || +Infinity;
		let dist = this._distance || 0;

		let curr = new L.LatLng(x, y);
		let prev = data.length ? data[data.length - 1].latlng : curr;

		let delta = curr.distanceTo(prev) * this._distanceFactor;

		dist = dist + Math.round(delta / 1000 * 100000) / 100000;

		// check and fix missing elevation data on last added point
		if (!this.options.skipNullZCoords && data.length > 0) {
			let prevZ = data[data.length - 1].z;
			if (isNaN(prevZ)) {
				let lastZ = this._lastValidZ;
				let currZ = z * this._heightFactor;
				if (!isNaN(lastZ) && !isNaN(currZ)) {
					prevZ = (lastZ + currZ) / 2;
				} else if (!isNaN(lastZ)) {
					prevZ = lastZ;
				} else if (!isNaN(currZ)) {
					prevZ = currZ;
				}
				if (!isNaN(prevZ)) data[data.length - 1].z = prevZ;
				else data.splice(data.length - 1, 1);
			}
		}

		z = z * this._heightFactor;

		// skip point if it has not elevation
		if (!isNaN(z)) {
			eleMax = eleMax < z ? z : eleMax;
			eleMin = eleMin > z ? z : eleMin;
			this._lastValidZ = z;
		}

		data.push({
			dist: dist,
			x: x,
			y: y,
			z: z,
			latlng: curr
		});

		this._data = data;
		this.track_info = this.track_info || {};
		this.track_info.distance = this._distance = dist;
		this.track_info.elevation_max = this._maxElevation = eleMax;
		this.track_info.elevation_min = this._minElevation = eleMin;

		this._fireEvt("eledata_updated", { index: data.length - 1 }, true);
	},

	_addLayer: function(layer) {
		if (layer) {
			if (layer._path) {
				L.DomUtil.addClass(layer._path, this.options.polyline.className + ' ' + this.options.theme);
			}
			layer
				.on("mousemove", this._mousemoveLayerHandler, this)
				.on("mouseout", this._mouseoutHandler, this);

			this._layers = this._layers || {};
			this._layers[L.Util.stamp(layer)] = layer;
		}
	},

	/**
	 * Generate "svg" chart container.
	 */
	_appendChart: function() {
		let opts = this.options;
		return container => {
			let svg = container.append("svg")
				.attr("class", "background")
				.attr("width", opts.width)
				.attr("height", opts.height);

			let g = svg
				.append("g")
				.attr("transform", "translate(" + opts.margins.left + "," + opts.margins.top + ")");

			g.call(this._appendGrid());
			g.call(this._appendAxis());
			g.call(this._appendAreaPath());
			g.call(this._appendFocusable());
			g.call(this._appendLegend());

			return svg;
		};
	},

	/**
	 * Adds the control to the given "detached" div.
	 */
	_appendElevationDiv: function(container) {
		let eleDiv = document.querySelector(this.options.elevationDiv);
		if (!eleDiv) {
			eleDiv = L.DomUtil.create('div', 'leaflet-control elevation elevation-div');
			this.options.elevationDiv = '#elevation-div_' + Math.random().toString(36).substr(2, 9);
			eleDiv.id = this.options.elevationDiv.substr(1);
			container.parentNode.insertBefore(eleDiv, container.nextSibling); // insert after end of container.
		}
		if (this.options.detached) {
			L.DomUtil.addClass(eleDiv, 'elevation-detached');
			L.DomUtil.removeClass(eleDiv, 'leaflet-control');
		}
		this.eleDiv = eleDiv;
		return this.eleDiv;
	},

	/**
	 * Generate "div" summary container.
	 */
	_appendSummary: function() {
		return container => {
			let summary = this.summaryDiv = container.append("div")
				.attr("class", "elevation-summary " + (this.options.summary ? this.options.summary + "-summary" : '')).node();

			this._updateSummary();
			return summary;
		};
	},

	_appendXaxis: function() {
		return D3.Axis({
			axis: "x",
			position: "bottom",
			width: this._width(),
			height: this._height(),
			scale: this._x,
			ticks: this.options.xTicks,
			label: this._xLabel,
			labelX: 30,
			labelY: this._width() + 6,
		});
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
			ticks: this.options.xTicks,
			tickFormat: "",
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
			labelX: -30,
			labelY: 3,
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
	 * Generate "path".
	 */
	_appendAreaPath: function() {
		return g => g.append('g')
			.attr("class", "area")
			.append('path');
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

	_appendFocusable: function() {
		return g => {
			return g.append('g')
				.attr("class", 'focus')
				.call(this._appendFocusRect())
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
					.on("touchmove.drag", this._dragHandler.bind(this))
					.on("touchstart.drag", this._dragStartHandler.bind(this))
					.on("touchstart.focus", this._mousemoveHandler.bind(this))
					.on("touchmove.focus", this._mousemoveHandler.bind(this));
				L.DomEvent.on(this._container, 'touchend', this._dragEndHandler, this);
			}

			focusRect
				.on("mousemove.drag", this._dragHandler.bind(this))
				.on("mousedown.drag", this._dragStartHandler.bind(this))
				.on("mouseenter.focus", this._mouseenterHandler.bind(this))
				.on("mousemove.focus", this._mousemoveHandler.bind(this))
				.on("mouseout.focus", this._mouseoutHandler.bind(this));
			L.DomEvent.on(this._container, 'mouseup', this._dragEndHandler, this);

			return focusRect;
		};
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
			if (!this.options.legend) return;

			let legend = this._legend = g.append('g')
				.attr("class", "legend");

			this._fireEvt("elechart_legend");

			let items = legend.selectAll('.legend-item')
				.on('click', (d, i) => {
					let target = items.nodes()[i];
					let name = target.getAttribute('data-name');
					let path = this._area.select('path[data-name="' + name + '"]').node();
					this._fireEvt("elepath_toggle", { path: path, name: name, legend: target, });
				});

			return legend;
		};
	},

	/*
	 * Calculates the full extent of the data array
	 */
	_calculateFullExtent: function(data) {
		if (!data || data.length < 1) {
			throw new Error("no data in parameters");
		}

		let ext = new L.latLngBounds(data[0].latlng, data[0].latlng);

		data.forEach(item => ext.extend(item.latlng));

		return ext;
	},

	/*
	 * Reset chart.
	 */
	_clearChart: function() {
		this._resetDrag();
	},

	/*
	 * Reset data.
	 */
	_clearData: function() {
		this._data = null;
		this._distance = null;
		this._maxElevation = null;
		this._minElevation = null;
		this.track_info = null;
		this._layers = null;
	},

	/*
	 * Reset path.
	 */
	_clearPath: function() {
		this._hidePositionMarker();
		for (let id in this._layers) {
			if (this._layers[id]._path) {
				L.DomUtil.removeClass(this._layers[id]._path, this.options.polyline.className);
				L.DomUtil.removeClass(this._layers[id]._path, this.options.theme);
			}
		}
	},

	/*
	 * Collapse current chart control.
	 */
	_collapse: function() {
		if (this._container) {
			L.DomUtil.removeClass(this._container, 'elevation-expanded');
			L.DomUtil.addClass(this._container, 'elevation-collapsed');
		}
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
	 * Handles end of drag operations. Zooms the map to the selected items extent.
	 */
	_dragEndHandler: function() {
		if (!this._dragStartCoords || !this._dragCurrentCoords || !this._gotDragged) {
			this._dragStartCoords = null;
			this._gotDragged = false;
			if (this._draggingEnabled) this._resetDrag();
			return;
		}

		let item1 = this._findItemForX(this._dragStartCoords[0]);
		let item2 = this._findItemForX(this._dragCurrentCoords[0]);

		if (item1 == item2) return;

		this._hidePositionMarker();

		this._fitSection(item1, item2);

		this._dragStartCoords = null;
		this._gotDragged = false;

		this._fireEvt("elechart_dragged", { data: { dragstart: this._data[item1], dragend: this._data[item2] } }, true);
	},

	/*
	 * Handles start of drag operations.
	 */
	_dragStartHandler: function() {
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
	 * Expand current chart control.
	 */
	_expand: function() {
		if (this._container) {
			L.DomUtil.removeClass(this._container, 'elevation-collapsed');
			L.DomUtil.addClass(this._container, 'elevation-expanded');
		}
	},

	/*
	 * Finds an item with the smallest delta in distance to the given latlng coords
	 */
	_findItemForLatLng: function(latlng) {
		let result = null;
		let d = Infinity;
		this._data.forEach(item => {
			let dist = latlng.distanceTo(item.latlng);
			if (dist < d) {
				d = dist;
				result = item;
			}
		});
		return result;
	},

	/*
	 * Finds a data entry for a given x-coordinate of the diagram
	 */
	_findItemForX: function(x) {
		let opts = this.options;
		let data = this._data ? this._data : [0, 1];
		let bisect = d3.bisector(d => d[opts.xAttr]).left;
		let xinvert = this._x.invert(x);
		return bisect(data, xinvert);
	},

	/**
	 * Fires an event of the specified type.
	 */
	_fireEvt: function(type, data, propagate) {
		if (this.fire) {
			this.fire(type, data, propagate);
		}
		if (this._map) {
			this._map.fire(type, data, propagate);
		}
	},

	/**
	 * Make the map fit the route section between given indexes.
	 */
	_fitSection: function(index1, index2) {
		let start = Math.min(index1, index2);
		let end = Math.max(index1, index2);
		let ext = this._calculateFullExtent(this._data.slice(start, end));
		this.fitBounds(ext);
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		let opts = this.options;
		return opts.height - opts.margins.top - opts.margins.bottom;
	},

	/*
	 * Hides the position/height indicator marker drawn onto the map
	 */
	_hidePositionMarker: function() {
		if (!this.options.autohideMarker) {
			return;
		}

		this._selectedItem = null;

		if (this._marker) {
			this._marker.remove();
		}
		if (this._heightG) {
			this._heightG.classed("hidden", true);
		}
		if (this._pointG) {
			this._pointG.classed("hidden", true);
		}
		if (this._focusG) {
			this._focusG.classed("hidden", true);
		}
	},

	/**
	 * Generate "svg" chart DOM element.
	 */
	_initChart: function() {
		let opts = this.options;

		if (opts.responsive) {
			if (opts.detached) {
				let offWi = this.eleDiv.offsetWidth;
				let offHe = this.eleDiv.offsetHeight;
				opts.width = offWi > 0 ? offWi : opts.width;
				opts.height = (offHe - 20) > 0 ? offHe - 20 : opts.height; // 20 = horizontal scrollbar size.
			} else {
				opts._maxWidth = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;
				let containerWidth = this._map._container.clientWidth;
				opts.width = opts._maxWidth > containerWidth ? containerWidth - 30 : opts.width;
			}
		}

		let scale = this._initScale();

		let container = d3.select(this._container)
			.call(this._appendChart())
			.call(this._appendSummary());

		let svg = this._svg = container.select('svg');
		this._grid = svg.select('.grid');
		this._area = svg.select('.area');
		this._path = svg.select('.area path');
		this._axis = svg.select('.axis');
		this._focus = svg.select('.focus');
		this._focusRect = svg.select('rect');
		this._x = scale.x;
		this._y = scale.y;

		this._fireEvt("elechart_init", null, true);
	},

	_initScale: function() {
		let opts = this.options;
		opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
		opts.yTicks = opts.yTicks || Math.round(this._height() / 30);

		this._updateScale();

		return { x: this._x, y: this._y };
	},

	/**
	 * Inspired by L.Control.Layers
	 */
	_initToggle: function(container) {
		//Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!this.options.detached) {
			L.DomEvent
				.disableClickPropagation(container);
			//.disableScrollPropagation(container);
		}

		if (L.Browser.mobile) {
			L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
		}

		L.DomEvent.on(container, 'mousewheel', this._mousewheelHandler, this);

		if (!this.options.detached) {
			let iconCssClass = "elevation-toggle " + this.options.controlButton.iconCssClass + (this.options.autohide ? "" : " close-button");
			let link = this._button = L.DomUtil.create('a', iconCssClass, container);
			link.href = '#';
			link.title = this.options.controlButton.title;

			if (this.options.collapsed) {
				this._collapse();
				if (this.options.autohide) {
					L.DomEvent
						.on(container, 'mouseover', this._expand, this)
						.on(container, 'mouseout', this._collapse, this);
				} else {
					L.DomEvent
						.on(link, 'click', L.DomEvent.stop)
						.on(link, 'click', this._toggle, this);
				}

				L.DomEvent.on(link, 'focus', this._toggle, this);

				this._map.on('click', this._collapse, this);
				// TODO: keyboard accessibility
			}
		} else {
			// TODO: handle autohide when detached=true
		}
	},

	/*
	 * Handles the moueseenter over the chart.
	 */
	_mouseenterHandler: function() {
		this._fireEvt("elechart_enter", null, true);
	},

	/*
	 * Handles the moueseover the chart and displays distance and altitude level.
	 */
	_mousemoveHandler: function(d, i, ctx) {
		if (!this._data || this._data.length === 0 || !this._chartEnabled) {
			return;
		}
		let coords = d3.mouse(this._focusRect.node());
		let xCoord = coords[0];
		let item = this._data[this._findItemForX(xCoord)];

		this._hidePositionMarker();
		this._showDiagramIndicator(item, xCoord);
		this._showPositionMarker(item);
		this._setMapView(item);

		if (this._map && this._map._container) {
			L.DomUtil.addClass(this._map._container, 'elechart-hover');
		}

		this._fireEvt("elechart_change", { data: item, xCoord: xCoord }, true);
		this._fireEvt("elechart_hover", { data: item, xCoord: xCoord }, true);
	},

	/*
	 * Handles mouseover events of the data layers on the map.
	 */
	_mousemoveLayerHandler: function(e) {
		if (!this._data || this._data.length === 0) {
			return;
		}
		let latlng = e.latlng;
		let item = this._findItemForLatLng(latlng);
		if (item) {
			let xCoord = item.xDiagCoord;

			this._hidePositionMarker();
			this._showDiagramIndicator(item, xCoord);
			this._showPositionMarker(item);

			this._fireEvt("elechart_change", { data: item, xCoord: xCoord }, true);
		}
	},

	/*
	 * Handles the moueseout over the chart.
	 */
	_mouseoutHandler: function() {
		if (!this.options.detached) {
			this._hidePositionMarker();
		}

		if (this._map && this._map._container) {
			L.DomUtil.removeClass(this._map._container, 'elechart-hover');
		}

		this._fireEvt("elechart_leave", null, true);
	},

	/*
	 * Handles the mouesewheel over the chart.
	 */
	_mousewheelHandler: function(e) {
		if (this._map.gestureHandling && this._map.gestureHandling._enabled) return;
		let ll = this._selectedItem ? this._selectedItem.latlng : this._map.getCenter();
		let z = e.deltaY > 0 ? this._map.getZoom() - 1 : this._map.getZoom() + 1;
		this._resetDrag();
		this._map.flyTo(ll, z);

	},

	/*
	 * Removes the drag rectangle and zoms back to the total extent of the data.
	 */
	_resetDrag: function() {
		if (this._dragRectangle) {
			this._dragRectangle.remove();;
			this._dragRectangle = null;
			this._hidePositionMarker();
		}
	},

	/**
	 * Resets drag, marker and bounds.
	 */
	_resetView: function() {
		if (this._map && this._map._isFullscreen) return;
		this._resetDrag();
		this._hidePositionMarker();
		this.fitBounds(this._fullExtent);
	},

	/**
	 * Hacky way for handling chart resize. Deletes it and redraw chart.
	 */
	_resizeChart: function() {
		if (this.options.responsive) {
			if (this.options.detached) {
				let newWidth = this.eleDiv.offsetWidth; // - 20;

				if (newWidth <= 0) return;

				this.options.width = newWidth;
				this.eleDiv.innerHTML = "";
				this.eleDiv.appendChild(this.onAdd(this._map));
			} else {
				this._map.removeControl(this._container);
				this.addTo(this._map);
			}
		}
	},

	/**
	 * Display distance and altitude level ("focus-rect").
	 */
	_showDiagramIndicator: function(item, xCoordinate) {
		if (!this._chartEnabled) return;

		let opts = this.options;
		let formatter = opts.hoverNumber.formatter;
		let [fx, fy] = [opts.hoverNumber.decimalsX, opts.hoverNumber.decimalsY];
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
				labelX: formatter(item[opts.xAttr], fx) + " " + this._xLabel,
				labelY: formatter(item[opts.yAttr], fy) + " " + this._yLabel,
			})
		);
	},

	/**
	 * Collapse or Expand current chart control.
	 */
	_toggle: function() {
		if (L.DomUtil.hasClass(this._container, "elevation-expanded"))
			this._collapse();
		else
			this._expand();
	},

	/**
	 * Sets the view of the map (center and zoom). Useful when "followMarker" is true.
	 */
	_setMapView: function(item) {
		if (!this.options.followMarker || !this._map) return;
		let zoom = this._map.getZoom();
		zoom = zoom < this._zFollow ? this._zFollow : zoom;
		this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
	},

	/*
	 * Shows the position/height indicator marker drawn onto the map
	 */
	_showPositionMarker: function(item) {
		this._selectedItem = item;
		if (this.options.marker == 'elevation-line') {
			this._updatePositionMarker(item);
		} else if (this.options.marker == 'position-marker') {
			this._updateLeafletMarker(item);
		}
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

		this._fireEvt('elechart_axis');
	},

	/**
	 * Calculates [x, y] domain and then update chart.
	 */
	_updateChart: function() {
		if (!this._data || !this._container) return;

		this._updateScale();
		this._updateAxis();
		this._updateAreaPath();

		this._fullExtent = this._calculateFullExtent(this._data);

		this._fireEvt('elechart_updated');
	},

	_updateAreaPath: function() {
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
	 * Update position marker ("leaflet-marker").
	 */
	_updateLeafletMarker: function(item) {
		if (!this._marker) {
			this._marker = L.marker(item.latlng, { icon: this.options.markerIcon, zIndexOffset: 1000000 })
				.addTo(this._map, { pane: 'elevationPane' });
		} else {
			this._marker.setLatLng(item.latlng);
		}
	},

	/**
	 * Update position marker ("leaflet-marker").
	 */
	_updatePositionMarker: function(item) {
		let opts = this.options;
		let point = L.extend({}, item, this._map.latLngToLayerPoint(item.latlng));

		let formatter = opts.hoverNumber.formatter;
		let fy = opts.hoverNumber.decimalsY;

		let normalizedAlt = this._height() / this._maxElevation * point.z;
		let normalizedY = point.y - normalizedAlt;

		if (!this._heightG) {
			let renderer = L.svg({ pane: "elevationPane" }).addTo(this._map); // default leaflet svg renderer
			let pane = d3.select(renderer.getPane()).select("svg");
			let g = this._heightG = pane.select("g").attr("class", "height-focus-group");
			this._mouseHeightFocus = g.append('svg:line');
			this._pointG = g.append("svg:circle");
			this._mouseHeightFocusLabel = g.append("svg:text");
		}

		this._heightG.classed("hidden", false);
		this._pointG.classed("hidden", false);

		this._pointG
			.call(
				D3.HeightFocusPoint({
					theme: this.options.theme,
					xCoord: point.x,
					yCoord: point.y,
				}));

		this._mouseHeightFocus
			.call(
				D3.HeightFocusLine({
					theme: this.options.theme,
					xCoord: point.x,
					yCoord: point.y,
					length: normalizedY
				})
			);

		this._mouseHeightFocusLabel
			.call(
				D3.HeightFocusLabel({
					theme: this.options.theme,
					xCoord: point.x,
					yCoord: normalizedY,
					label: formatter(point[opts.yAttr], fy) + " " + this._yLabel
				})
			);
	},

	_updateScale: function() {
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
	},

	/**
	 * Update chart summary.
	 */
	_updateSummary: function() {
		this.summaryDiv.innerHTML = '';
		this.track_info = this.track_info || {};
		this.track_info.distance = this._distance || 0;
		this.track_info.elevation_max = this._maxElevation || 0;
		this.track_info.elevation_min = this._minElevation || 0;

		if (this.options.summary) {
			this._fireEvt("elechart_summary");
		}
		if (this.options.downloadLink && this._downloadURL) { // TODO: generate dynamically file content instead of using static file urls.
			this.summaryDiv.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>'
			this.summaryDiv.querySelector('.download a').onclick = (e) => {
				e.preventDefault();
				this._fireEvt('eletrack_download', { downloadLink: this.options.downloadLink, confirm: _.saveFile.bind(this._downloadURL) });
			};
		};
	},


	/**
	 * Calculates chart width.
	 */
	_width: function() {
		let opts = this.options;
		return opts.width - opts.margins.left - opts.margins.right;
	},

});

L.control.elevation = (options) => new Elevation(options);

Elevation.Utils = _;
Elevation.Components = D3;

Elevation.addInitHook(function() {

	this.on('waypoint_added', function(e) {
		let p = e.point,
			pop = p._popup;
		if (pop) {
			pop.options.className = 'elevation-popup';
		}
		if (pop._content) {
			pop._content = decodeURI(pop._content);
			p.bindTooltip(pop._content, { direction: 'top', sticky: true, opacity: 1, className: 'elevation-tooltip' }).openTooltip();
		}
	});

	this.on('elepath_toggle', function(e) {
		let path = e.path;

		let enabled = L.DomUtil.hasClass(path, 'hidden');
		let text = d3.select(e.legend).select('text');

		if (enabled) {
			L.DomUtil.removeClass(path, 'hidden');
			text.style("text-decoration-line", "")
		} else {
			L.DomUtil.setClass(path, 'hidden');
			text.style("text-decoration-line", "line-through")
		}

		this._chartEnabled = this._area.selectAll('path:not(.hidden)').nodes().length != 0;

		// autotoggle chart data on single click
		if (!this._chartEnabled) {;
			this._resetDrag();
			this._clearPath();
		} else {
			// this._resizeChart();
			for (let id in this._layers) {
				if (this._layers[id]._path) {
					L.DomUtil.addClass(this._layers[id]._path, this.options.polyline.className + ' ' + this.options.theme);
				}
			}
		}
	});

	this.on("elechart_legend", function() {
		this._altitudeLegend = this._legend.append('g')
			.call(
				D3.LegendItem({
					name: 'Altitude',
					width: this._width(),
					height: this._height(),
					margins: this.options.margins,
				})
			);
	});

	this.on("elechart_summary", function() {
		this.summaryDiv.innerHTML +=
			'<span class="totlen"><span class="summarylabel">' + L._("Total Length: ") + '</span><span class="summaryvalue">' + this.track_info.distance.toFixed(2) + '&nbsp;' + this._xLabel + '</span></span>' +
			'<span class="maxele"><span class="summarylabel">' + L._("Max Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_max.toFixed(2) + '&nbsp;' + this._yLabel + '</span></span>' +
			'<span class="minele"><span class="summarylabel">' + L._("Min Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_min.toFixed(2) + '&nbsp;' + this._yLabel + '</span></span>';
	});

	this.on("eletrack_download", function(e) {
		if (e.downloadLink == 'modal' && typeof CustomEvent === "function") {
			document.dispatchEvent(new CustomEvent("eletrack_download", { detail: e }));
		} else if (e.downloadLink == 'link' || e.downloadLink === true) {
			e.confirm();
		}
	});

	this.on('eledata_loaded', function(e) {
		let layer = e.layer;
		if (this._map) {
			this._map.once('layeradd', function(e) {
				this.fitBounds(layer.getBounds());
			}, this);
			layer.addTo(this._map);
		} else {
			console.warn("Undefined elevation map object");
		}
	});

	this.on('eledata_clear', function() {
		this._area.selectAll('path')
			.attr("d", "M0 0");
		if (this._path) {
			// this._x.domain([0, 1]);
			// this._y.domain([0, 1]);
			// this._updateAxis();
		}
	});


});
