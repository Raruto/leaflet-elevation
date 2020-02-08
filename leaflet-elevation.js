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
L.Control.Elevation = L.Control.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	options: {
		autohide: true,
		autohideMarker: true,
		collapsed: false,
		controlButton: {
			iconCssClass: "elevation-toggle-icon",
			title: "Elevation"
		},
		detached: true,
		distanceFactor: 1,
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
			polyline_options: {
				className: '',
				color: '#566B13',
				opacity: 0.75,
				weight: 5,
				lineCap: 'round'
			},
		},
		height: 200,
		heightFactor: 1,
		hoverNumber: {
			decimalsX: 2,
			decimalsY: 0,
			formatter: undefined
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
		xLabel: "km",
		xTicks: undefined,
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
		this._addData(d);

		if (this._container) {
			this._applyData();
		}
		if ((typeof layer === "undefined" || layer === null) && d.on) {
			layer = d;
		}
		if (layer) {
			if (layer._path) {
				L.DomUtil.addClass(layer._path, 'elevation-polyline ' + this.options.theme);
			}
			layer
				.on("mousemove", this._mousemoveLayerHandler, this)
				.on("mouseout", this._mouseoutHandler, this);
		}

		this.track_info = this.track_info || {};
		this.track_info.distance = this._distance;
		this.track_info.elevation_max = this._maxElevation;
		this.track_info.elevation_min = this._minElevation;

		this._layers = this._layers || {};
		this._layers[L.Util.stamp(layer)] = layer;

		var evt = {
			data: d,
			layer: layer,
			track_info: this.track_info,
		};
		if (this.fire) this.fire("eledata_added", evt, true);
		if (this._map) this._map.fire("eledata_added", evt, true);
	},

	addTo: function(map) {
		if (this.options.detached) {
			this._addToChartDiv(map);
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

		if (this.fire) this.fire("eledata_clear");
		if (this._map) this._map.fire("eledata_clear");
	},

	disableDragging: function() {
		this._draggingEnabled = false;
		this._resetDrag();
	},

	enableDragging: function() {
		this._draggingEnabled = true;
	},

	fitBounds: function(bounds) {
		bounds = bounds || this._fullExtent;
		if (this._map && bounds) this._map.fitBounds(bounds);
	},

	getZFollow: function() {
		return this._zFollow;
	},

	hide: function() {
		this._container.style.display = "none";
	},

	initialize: function(options) {
		this.options.autohide = typeof options.autohide !== "undefined" ? options.autohide : !L.Browser.mobile;

		// Aliases.
		if (typeof options.detachedView !== "undefined") this.options.detached = options.detachedView;
		if (typeof options.responsiveView !== "undefined") this.options.responsive = options.responsiveView;
		if (typeof options.showTrackInfo !== "undefined") this.options.summary = options.showTrackInfo;
		if (typeof options.summaryType !== "undefined") this.options.summary = options.summaryType;
		if (typeof options.autohidePositionMarker !== "undefined") this.options.autohideMarker = options.autohidePositionMarker;
		if (typeof options.followPositionMarker !== "undefined") this.options.followMarker = options.followPositionMarker;
		if (typeof options.useLeafletMarker !== "undefined") this.options.marker = options.useLeafletMarker ? 'position-marker' : 'elevation-line';
		if (typeof options.leafletMarkerIcon !== "undefined") this.options.markerIcon = options.leafletMarkerIcon;
		if (typeof options.download !== "undefined") this.options.downloadLink = options.download;

		// L.Util.setOptions(this, options);
		this.options = this._deepMerge({}, this.options, options);

		this._draggingEnabled = !L.Browser.mobile;
		this._chartEnabled = true;

		if (options.imperial) {
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

	loadData: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		if (opts.defer) {
			this.loadDefer(data, opts);
		} else if (opts.lazy) {
			this.loadLazy(data, opts);
		} else if (this._isXMLDoc(data)) {
			this.loadGPX(data);
		} else if (this._isJSONDoc(data)) {
			this.loadGeoJSON(data);
		} else {
			this.loadFile(data);
		}
	},

	loadDefer: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		opts.defer = false;
		if (document.readyState !== 'complete') window.addEventListener("load", L.bind(this.loadData, this, data, opts), { once: true });
		else this.loadData(data, opts)
	},

	loadFile: function(url) {
		this._downloadURL = url; // TODO: handle multiple urls?
		try {
			var xhr = new XMLHttpRequest();
			xhr.responseType = "text";
			xhr.open('GET', url);
			xhr.onload = function() {
				if (xhr.status !== 200) {
					throw "Error " + xhr.status + " while fetching remote file: " + url;
				} else {
					this.loadData(xhr.response, { lazy: false, defer: false });
				}
			}.bind(this);
			xhr.send();
		} catch (e) {
			console.warn(e);
		}
	},

	loadGeoJSON: function(data) {
		if (typeof data === "string") {
			data = JSON.parse(data);
		}

		this.layer = this.geojson = L.geoJson(data, {
			style: function(feature) {
				return {
					color: '#566B13',
					className: 'elevation-polyline ' + this.options.theme,
				};
			}.bind(this),
			onEachFeature: function(feature, layer) {
				this.addData(feature, layer);

				this.track_info = this.track_info || {};
				this.track_info.type = "geojson";
				this.track_info.name = data.name;
				this.track_info.distance = this._distance;
				this.track_info.elevation_max = this._maxElevation;
				this.track_info.elevation_min = this._minElevation;

			}.bind(this),
		});
		if (this._map) {
			this._map.once('layeradd', function(e) {
				this.fitBounds(this.layer.getBounds());
				var evt = {
					data: data,
					layer: this.layer,
					name: this.track_info.name,
					track_info: this.track_info,
				};
				if (this.fire) this.fire("eledata_loaded", evt, true);
				if (this._map) this._map.fire("eledata_loaded", evt, true);
			}, this);

			this.layer.addTo(this._map);
		} else {
			console.warn("Undefined elevation map object");
		}
	},

	loadGPX: function(data) {
		var callback = function(data) {
			this.options.gpxOptions.polyline_options.className += 'elevation-polyline ' + this.options.theme;

			this.layer = this.gpx = new L.GPX(data, this.options.gpxOptions);

			this.layer.on('loaded', function(e) {
				this.fitBounds(e.target.getBounds());
			}, this);
			this.layer.on('addpoint', function(e) {
				if (e.point._popup) {
					e.point._popup.options.className = 'elevation-popup';
					e.point._popup._content = decodeURI(e.point._popup._content);
				}
				if (e.point._popup && e.point._popup._content) {
					e.point.bindTooltip(e.point._popup._content, { direction: 'top', sticky: true, opacity: 1, className: 'elevation-tooltip' }).openTooltip();
				}
			});
			this.layer.once("addline", function(e) {
				this.addData(e.line /*, this.layer*/ );

				this.track_info = this.track_info || {};
				this.track_info.type = "gpx";
				this.track_info.name = this.layer.get_name();
				this.track_info.distance = this._distance;
				this.track_info.elevation_max = this._maxElevation;
				this.track_info.elevation_min = this._minElevation;

				var evt = {
					data: data,
					layer: this.layer,
					name: this.track_info.name,
					track_info: this.track_info,
				};

				if (this.fire) this.fire("eledata_loaded", evt, true);
				if (this._map) this._map.fire("eledata_loaded", evt, true);
			}, this);

			if (this._map) {
				this.layer.addTo(this._map);
			} else {
				console.warn("Undefined elevation map object");
			}
		}.bind(this, data);
		if (typeof L.GPX !== 'function' && this.options.lazyLoadJS) {
			L.Control.Elevation._gpxLazyLoader = this._lazyLoadJS('https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.4.0/gpx.js', L.Control.Elevation._gpxLazyLoader);
			L.Control.Elevation._gpxLazyLoader.then(callback);
		} else {
			callback.call();
		}
	},

	loadLazy: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		opts.lazy = false;
		let ticking = false;
		let scrollFn = L.bind(function(data) {
			if (!ticking) {
				L.Util.requestAnimFrame(function() {
					if (this._isVisible(this.placeholder)) {
						window.removeEventListener('scroll', scrollFn);
						this.loadData(data, opts);
						this.once('eledata_loaded', function() {
							if (this.placeholder && this.placeholder.parentNode) {
								this.placeholder.parentNode.removeChild(this.placeholder);
							}
						}, this)
					}
					ticking = false;
				}, this);
				ticking = true;
			}
		}, this, data);
		window.addEventListener('scroll', scrollFn);
		if (this.placeholder) this.placeholder.addEventListener('mouseenter', scrollFn, { once: true });
		scrollFn();
	},

	onAdd: function(map) {
		this._map = map;

		var container = this._container = L.DomUtil.create("div", "elevation-control elevation");

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

		var callback = function(map, container) {
			this._initToggle(container);
			this._initChart(container);

			this._applyData();

			this._map.on('zoom viewreset zoomanim', this._hidePositionMarker, this);
			this._map.on('resize', this._resetView, this);
			this._map.on('resize', this._resizeChart, this);
			this._map.on('mousedown', this._resetDrag, this);

			this._map.on('eledata_loaded', this._updateSummary, this);

			L.DomEvent.on(this._map._container, 'mousewheel', this._resetDrag, this);
			L.DomEvent.on(this._map._container, 'touchstart', this._resetDrag, this);

		}.bind(this, map, container);
		if (typeof d3 !== 'object' && this.options.lazyLoadJS) {
			L.Control.Elevation._d3LazyLoader = this._lazyLoadJS('https://unpkg.com/d3@4.13.0/build/d3.min.js', L.Control.Elevation._d3LazyLoader);
			L.Control.Elevation._d3LazyLoader.then(callback);
		} else {
			callback.call();
		}
		return container;
	},

	onRemove: function(map) {
		this._container = null;
	},

	redraw: function() {
		this._resizeChart();
	},

	setZFollow: function(zoom) {
		this._zFollow = zoom;
	},

	show: function() {
		this._container.style.display = "block";
	},

	/*
	 * Parsing data either from GPX or GeoJSON and update the diagram data
	 */
	_addData: function(d) {
		var geom = d && d.geometry && d.geometry;
		var i;

		if (geom) {
			switch (geom.type) {
				case 'LineString':
					this._addGeoJSONData(geom.coordinates);
					break;

				case 'MultiLineString':
					for (i = 0; i < geom.coordinates.length; i++) {
						this._addGeoJSONData(geom.coordinates[i]);
					}
					break;

				default:
					console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
			}
		}

		var feat = d && d.type === "FeatureCollection";
		if (feat) {
			for (i = 0; i < d.features.length; i++) {
				this._addData(d.features[i]);
			}
		}

		if (d && d._latlngs) {
			this._addGPXdata(d._latlngs);
		}
	},

	/*
	 * Parsing of GeoJSON data lines and their elevation in z-coordinate
	 */
	_addGeoJSONData: function(coords) {
		if (coords) {
			for (var i = 0; i < coords.length; i++) {
				this._addPoint(coords[i][1], coords[i][0], coords[i][2]);
			}
		}
	},

	/*
	 * Parsing function for GPX data and their elevation in z-coordinate
	 */
	_addGPXdata: function(coords) {
		if (coords) {
			for (var i = 0; i < coords.length; i++) {
				this._addPoint(coords[i].lat, coords[i].lng, coords[i].meta.ele);
			}
		}
	},

	_addPoint: function(x, y, z) {
		if (this.options.reverseCoords) {
			var tmp = x;
			x = y;
			y = tmp;
		}

		var data = this._data || [];
		var eleMax = this._maxElevation || -Infinity;
		var eleMin = this._minElevation || +Infinity;
		var dist = this._distance || 0;

		var curr = new L.LatLng(x, y);
		var prev = data.length ? data[data.length - 1].latlng : curr;

		var delta = curr.distanceTo(prev) * this._distanceFactor;

		dist = dist + Math.round(delta / 1000 * 100000) / 100000;

		// check and fix missing elevation data on last added point
		if (!this.options.skipNullZCoords && data.length > 0) {
			var prevZ = data[data.length - 1].z;
			if (isNaN(prevZ)) {
				var lastZ = this._lastValidZ;
				var currZ = z * this._heightFactor;
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
		this._distance = dist;
		this._maxElevation = eleMax;
		this._minElevation = eleMin;
	},

	_addToChartDiv: function(map) {
		this._appendElevationDiv(map._container).appendChild(this.onAdd(map));
	},

	_appendChart: function(svg) {
		var g = svg
			.append("g")
			.attr("transform", "translate(" + this.options.margins.left + "," + this.options.margins.top + ")");

		this._appendGrid(g);
		this._appendAreaPath(g);
		this._appendAxis(g);
		this._appendFocusRect(g);
		this._appendMouseFocusG(g);
		this._appendLegend(g);
	},

	_appendElevationDiv: function(container) {
		var eleDiv = document.querySelector(this.options.elevationDiv);
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

	_appendXaxis: function(axis) {
		axis
			.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + this._height() + ")")
			.call(
				d3
				.axisBottom()
				.scale(this._x)
				.ticks(this.options.xTicks)
			)
			.append("text")
			.attr("x", this._width() + 6)
			.attr("y", 30)
			.text(this._xLabel);
	},

	_appendXGrid: function(grid) {
		grid.append("g")
			.attr("class", "x grid")
			.attr("transform", "translate(0," + this._height() + ")")
			.call(
				d3
				.axisBottom()
				.scale(this._x)
				.ticks(this.options.xTicks)
				.tickSize(-this._height())
				.tickFormat("")
			);

	},

	_appendYaxis: function(axis) {
		axis
			.append("g")
			.attr("class", "y axis")
			.call(
				d3
				.axisLeft()
				.scale(this._y)
				.ticks(this.options.yTicks)
			)
			.append("text")
			.attr("x", -30)
			.attr("y", 3)
			.text(this._yLabel);
	},

	_appendYGrid: function(grid) {
		grid.append("g")
			.attr("class", "y grid")
			.call(
				d3
				.axisLeft()
				.scale(this._y)
				.ticks(this.options.yTicks)
				.tickSize(-this._width())
				.tickFormat("")
			);
	},

	_appendAreaPath: function(g) {
		this._areapath = g.append("path")
			.attr("class", "area");
	},

	_appendAxis: function(g) {
		this._axis = g.append("g")
			.attr("class", "axis");
		this._appendXaxis(this._axis);
		this._appendYaxis(this._axis);
	},

	_appendFocusRect: function(g) {
		var focusRect = this._focusRect = g.append("rect")
			.attr("width", this._width())
			.attr("height", this._height())
			.style("fill", "none")
			.style("stroke", "none")
			.style("pointer-events", "all");

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
	},

	_appendGrid: function(g) {
		this._grid = g.append("g")
			.attr("class", "grid");
		this._appendXGrid(this._grid);
		this._appendYGrid(this._grid);
	},

	_appendMouseFocusG: function(g) {
		var focusG = this._focusG = g.append("g")
			.attr("class", "mouse-focus-group");

		this._mousefocus = focusG.append('svg:line')
			.attr('class', 'mouse-focus-line')
			.attr('x2', '0')
			.attr('y2', '0')
			.attr('x1', '0')
			.attr('y1', '0');

		this._focuslabelrect = focusG.append("rect")
			.attr('class', 'mouse-focus-label')
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", 0)
			.attr("height", 0)
			.attr("rx", 3)
			.attr("ry", 3);

		this._focuslabeltext = focusG.append("svg:text")
			.attr("class", "mouse-focus-label-text");
		this._focuslabelY = this._focuslabeltext.append("svg:tspan")
			.attr("class", "mouse-focus-label-y")
			.attr("dy", "-1em");
		this._focuslabelX = this._focuslabeltext.append("svg:tspan")
			.attr("class", "mouse-focus-label-x")
			.attr("dy", "2em");
	},

	_appendLegend: function(g) {
		if (!this.options.legend) return;

		var legend = this._legend = g.append('g')
			.attr("class", "legend");

		var altitude = this._altitudeLegend = this._legend.append('g')
			.attr("class", "legend-altitude");

		altitude.append("rect")
			.attr("class", "area")
			.attr("x", (this._width() / 2) - 50)
			.attr("y", this._height() + this.options.margins.bottom - 17)
			.attr("width", 50)
			.attr("height", 5)
			.attr("opacity", 0.75);

		altitude.append('text')
			.text('Altitude')
			.attr("x", (this._width() / 2) + 5)
			.attr("font-size", 10)
			.style("text-decoration-thickness", "2px")
			.style("font-weight", "700")
			.attr('y', this._height() + this.options.margins.bottom - 11);

	},

	_appendPositionMarker: function(pane) {
		var theme = this.options.theme;
		var heightG = pane.select("g");

		this._mouseHeightFocus = heightG.append('svg:line')
			.attr("class", theme + " height-focus line")
			.attr("x2", 0)
			.attr("y2", 0)
			.attr("x1", 0)
			.attr("y1", 0);

		this._pointG = heightG.append("g");
		this._pointG.append("svg:circle")
			.attr("class", theme + " height-focus circle-lower")
			.attr("r", 6)
			.attr("cx", 0)
			.attr("cy", 0);

		this._mouseHeightFocusLabel = heightG.append("svg:text")
			.attr("class", theme + " height-focus-label")
			.style("pointer-events", "none");
	},

	_applyData: function() {
		if (!this._data) return;

		var xdomain = d3.extent(this._data, function(d) {
			return d.dist;
		});
		var ydomain = d3.extent(this._data, function(d) {
			return d.z;
		});
		var opts = this.options;

		if (opts.yAxisMin !== undefined && (opts.yAxisMin < ydomain[0] || opts.forceAxisBounds)) {
			ydomain[0] = opts.yAxisMin;
		}
		if (opts.yAxisMax !== undefined && (opts.yAxisMax > ydomain[1] || opts.forceAxisBounds)) {
			ydomain[1] = opts.yAxisMax;
		}

		this._x.domain(xdomain);
		this._y.domain(ydomain);
		this._areapath.datum(this._data)
			.attr("d", this._area);
		this._updateAxis();

		this._fullExtent = this._calculateFullExtent(this._data);
	},

	/*
	 * Calculates the full extent of the data array
	 */
	_calculateFullExtent: function(data) {
		if (!data || data.length < 1) {
			throw new Error("no data in parameters");
		}

		var ext = new L.latLngBounds(data[0].latlng, data[0].latlng);

		data.forEach(function(item) {
			ext.extend(item.latlng);
		});

		return ext;
	},

	_clearChart: function() {
		this._resetDrag();
		if (this._areapath) {
			// workaround for 'Error: Problem parsing d=""' in Webkit when empty data
			// https://groups.google.com/d/msg/d3-js/7rFxpXKXFhI/HzIO_NPeDuMJ
			//this._areapath.datum(this._data).attr("d", this._area);
			this._areapath.attr("d", "M0 0");

			this._x.domain([0, 1]);
			this._y.domain([0, 1]);
			this._updateAxis();
		}
		if (this._altitudeLegend) {
			this._altitudeLegend.select('text').style("text-decoration-line", "line-through");
		}
	},

	/*
	 * Reset data
	 */
	_clearData: function() {
		this._data = null;
		this._distance = null;
		this._maxElevation = null;
		this._minElevation = null;
		this.track_info = null;
		this._layers = null;
		// if (this.layer) {
		// 	this.layer.removeFrom(this._map);
		// }
	},

	_clearPath: function() {
		this._hidePositionMarker();
		for (var id in this._layers) {
			L.DomUtil.removeClass(this._layers[id]._path, "elevation-polyline");
			L.DomUtil.removeClass(this._layers[id]._path, this.options.theme);
		}
	},

	_collapse: function() {
		if (this._container) {
			L.DomUtil.removeClass(this._container, 'elevation-expanded');
			L.DomUtil.addClass(this._container, 'elevation-collapsed');
		}
	},

	_deepMerge: function(target, ...sources) {
		if (!sources.length) return target;
		const source = sources.shift();
		if (this._isObject(target) && this._isObject(source)) {
			for (const key in source) {
				if (this._isObject(source[key])) {
					if (!target[key]) Object.assign(target, {
						[key]: {}
					});
					this._deepMerge(target[key], source[key]);
				} else {
					Object.assign(target, {
						[key]: source[key]
					});
				}
			}
		}
		return this._deepMerge(target, ...sources);
	},

	_saveFile: function(fileUrl) {
		var d = document,
			a = d.createElement('a'),
			b = d.body;
		a.href = fileUrl;
		a.target = '_new';
		a.download = ""; // fileName
		a.style.display = 'none';
		b.appendChild(a);
		a.click();
		b.removeChild(a);
	},

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
			// autotoggle chart data on single click
			if (this._chartEnabled) {
				this._clearChart();
				this._clearPath();
				this._chartEnabled = false;
			} else {
				this._resizeChart();
				this._chartEnabled = true;
			}
			return;
		}

		var item1 = this._findItemForX(this._dragStartCoords[0]),
			item2 = this._findItemForX(this._dragCurrentCoords[0]);

		if (item1 == item2) return;

		this._hidePositionMarker();

		this._fitSection(item1, item2);

		this._dragStartCoords = null;
		this._gotDragged = false;

		var evt = {
			data: {
				dragstart: this._data[item1],
				dragend: this._data[item2]
			}
		};
		if (this.fire) this.fire("elechart_dragged", evt, true);
		if (this._map) this._map.fire("elechart_dragged", evt, true);
	},

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
		if (!this._dragStartCoords || !this._draggingEnabled) {
			return;
		}

		var dragEndCoords = this._dragCurrentCoords = d3.mouse(this._focusRect.node());

		var x1 = Math.min(this._dragStartCoords[0], dragEndCoords[0]),
			x2 = Math.max(this._dragStartCoords[0], dragEndCoords[0]);

		if (!this._dragRectangle && !this._dragRectangleG) {
			var g = d3.select(this._container).select("svg").select("g");

			this._dragRectangleG = g.insert("g", ".mouse-focus-group");

			this._dragRectangle = this._dragRectangleG.append("rect")
				.attr("width", x2 - x1)
				.attr("height", this._height())
				.attr("x", x1)
				.attr('class', 'mouse-drag')
				.style("pointer-events", "none");
		} else {
			this._dragRectangle.attr("width", x2 - x1)
				.attr("x", x1);
		}
	},

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
		var result = null,
			d = Infinity;
		this._data.forEach(function(item) {
			var dist = latlng.distanceTo(item.latlng);
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
		var bisect = d3.bisector(function(d) {
			return d.dist;
		}).left;
		var xinvert = this._x.invert(x);
		return bisect(this._data, xinvert);
	},

	/**
	 * Make the map fit the route section between given indexes.
	 */
	_fitSection: function(index1, index2) {
		var start = Math.min(index1, index2);
		var end   = Math.max(index1, index2);
		var ext   = this._calculateFullExtent(this._data.slice(start, end));
		this.fitBounds(ext);
	},

	/*
	 * Fromatting funciton using the given decimals and seperator
	 */
	_formatter: function(num, dec, sep) {
		var res;
		if (dec === 0) {
			res = Math.round(num) + "";
		} else {
			res = L.Util.formatNum(num, dec) + "";
		}
		var numbers = res.split(".");
		if (numbers[1]) {
			var d = dec - numbers[1].length;
			for (; d > 0; d--) {
				numbers[1] += "0";
			}
			res = numbers.join(sep || ".");
		}
		return res;
	},

	_height: function() {
		var opts = this.options;
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
			if (this._map) this._map.removeLayer(this._marker);
			this._marker = null;
		}
		if (this._mouseHeightFocus) {
			this._mouseHeightFocus.style("visibility", "hidden");
			this._mouseHeightFocusLabel.style("visibility", "hidden");
		}
		if (this._pointG) {
			this._pointG.style("visibility", "hidden");
		}
		if (this._focusG) {
			this._focusG.style("visibility", "hidden");
		}
	},

	_initChart: function() {
		var opts = this.options;
		opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
		opts.yTicks = opts.yTicks || Math.round(this._height() / 30);
		opts.hoverNumber.formatter = opts.hoverNumber.formatter || this._formatter;

		if (opts.responsive) {
			if (opts.detached) {
				var offWi = this.eleDiv.offsetWidth;
				var offHe = this.eleDiv.offsetHeight;
				opts.width = offWi > 0 ? offWi : opts.width;
				opts.height = (offHe - 20) > 0 ? offHe - 20 : opts.height; // 20 = horizontal scrollbar size.
			} else {
				opts._maxWidth = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;
				var containerWidth = this._map._container.clientWidth;
				opts.width = opts._maxWidth > containerWidth ? containerWidth - 30 : opts.width;
			}
		}

		var x = this._x = d3.scaleLinear().range([0, this._width()]);
		var y = this._y = d3.scaleLinear().range([this._height(), 0]);

		var interpolation = typeof opts.interpolation === 'function' ? opts.interpolation : d3[opts.interpolation];

		var area = this._area = d3.area().curve(interpolation)
			.x(function(d) {
				return (d.xDiagCoord = x(d.dist));
			})
			.y0(this._height())
			.y1(function(d) {
				return y(d.z);
			});
		var line = this._line = d3.line()
			.x(function(d) {
				return d3.mouse(svg.select("g"))[0];
			})
			.y(function(d) {
				return this._height();
			});

		var container = d3.select(this._container);

		var svg = container.append("svg")
			.attr("class", "background")
			.attr("width", opts.width)
			.attr("height", opts.height);

		var summary = this.summaryDiv = container.append("div")
			.attr("class", "elevation-summary " + this.options.summary + "-summary").node();

		this._appendChart(svg);
		this._updateSummary();

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
			var iconCssClass = "elevation-toggle " + this.options.controlButton.iconCssClass + (this.options.autohide ? "" : " close-button");
			var link = this._button = L.DomUtil.create('a', iconCssClass, container);
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

	_isObject: function(item) {
		return (item && typeof item === 'object' && !Array.isArray(item));
	},

	_isJSONDoc: function(doc, lazy) {
		lazy = typeof lazy === "undefined" ? true : lazy;
		if (typeof doc === "string" && lazy) {
			doc = doc.trim();
			return doc.indexOf("{") == 0 || doc.indexOf("[") == 0;
		} else {
			try {
				JSON.parse(doc.toString());
			} catch (e) {
				if (typeof doc === "object" && lazy) return true;
				console.warn(e);
				return false;
			}
			return true;
		}
	},

	_isXMLDoc: function(doc, lazy) {
		lazy = typeof lazy === "undefined" ? true : lazy;
		if (typeof doc === "string" && lazy) {
			doc = doc.trim();
			return doc.indexOf("<") == 0;
		} else {
			var documentElement = (doc ? doc.ownerDocument || doc : 0).documentElement;
			return documentElement ? documentElement.nodeName !== "HTML" : false;
		}
	},

	_isDomVisible: function(elem) {
		return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
	},

	_isVisible: function(elem) {
		if (!elem) return false;

		let styles = window.getComputedStyle(elem);

		function isVisibleByStyles(elem, styles) {
			return styles.visibility !== 'hidden' && styles.display !== 'none';
		}

		function isAboveOtherElements(elem, styles) {
			let boundingRect = elem.getBoundingClientRect();
			let left = boundingRect.left + 1;
			let right = boundingRect.right - 1;
			let top = boundingRect.top + 1;
			let bottom = boundingRect.bottom - 1;
			let above = true;

			let pointerEvents = elem.style.pointerEvents;

			if (styles['pointer-events'] == 'none') elem.style.pointerEvents = 'auto';

			if (document.elementFromPoint(left, top) !== elem) above = false;
			if (document.elementFromPoint(right, top) !== elem) above = false;

			// Only for completely visible elements
			// if (document.elementFromPoint(left, bottom) !== elem) above = false;
			// if (document.elementFromPoint(right, bottom) !== elem) above = false;

			elem.style.pointerEvents = pointerEvents;

			return above;
		}

		if (!isVisibleByStyles(elem, styles)) return false;
		if (!isAboveOtherElements(elem, styles)) return false;
		return true;
	},

	_lazyLoadJS: function(url, skip) {
		if (typeof skip == "undefined") {
			skip = false;
		}
		if (skip instanceof Promise) {
			return skip;
		}
		return new Promise(function(resolve, reject) {
			if (skip) return resolve();
			var tag = document.createElement("script");
			tag.addEventListener('load', resolve, { once: true });
			tag.src = url;
			document.head.appendChild(tag);
		});
	},

	_mouseenterHandler: function() {
		if (this.fire) {
			this.fire("elechart_enter", null, true);
		}
		if (this._map) {
			this._map.fire("elechart_enter", null, true);
		}
	},

	/*
	 * Handles the moueseover the chart and displays distance and altitude level
	 */
	_mousemoveHandler: function(d, i, ctx) {
		if (!this._data || this._data.length === 0 || !this._chartEnabled) {
			return;
		}
		var coords = d3.mouse(this._focusRect.node());
		var xCoord = coords[0];
		var item = this._data[this._findItemForX(xCoord)];

		this._hidePositionMarker();
		this._showDiagramIndicator(item, xCoord);
		this._showPositionMarker(item);
		this._setMapView(item);

		if (this._map && this._map._container) {
			L.DomUtil.addClass(this._map._container, 'elechart-hover');
		}

		var evt = {
			data: item
		};
		if (this.fire) {
			this.fire("elechart_change", evt, true);
			this.fire("elechart_hover", evt, true);
		}
		if (this._map) {
			this._map.fire("elechart_change", evt, true);
			this._map.fire("elechart_hover", evt, true);
		}
	},

	/*
	 * Handles mouseover events of the data layers on the map.
	 */
	_mousemoveLayerHandler: function(e) {
		if (!this._data || this._data.length === 0) {
			return;
		}
		var latlng = e.latlng;
		var item = this._findItemForLatLng(latlng);
		if (item) {
			var xCoord = item.xDiagCoord;

			this._hidePositionMarker();
			this._showDiagramIndicator(item, xCoord);
			this._showPositionMarker(item);
		}
	},

	_mouseoutHandler: function() {
		if (!this.options.detached) {
			this._hidePositionMarker();
		}

		if (this._map && this._map._container) {
			L.DomUtil.removeClass(this._map._container, 'elechart-hover');
		}

		if (this.fire) this.fire("elechart_leave", null, true);
		if (this._map) this._map.fire("elechart_leave", null, true);
	},

	_mousewheelHandler: function(e) {
		if (this._map.gestureHandling && this._map.gestureHandling._enabled) return;
		var ll = this._selectedItem ? this._selectedItem.latlng : this._map.getCenter();
		var z = e.deltaY > 0 ? this._map.getZoom() - 1 : this._map.getZoom() + 1;
		this._resetDrag();
		this._map.flyTo(ll, z);

	},

	/*
	 * Removes the drag rectangle and zoms back to the total extent of the data.
	 */
	_resetDrag: function() {
		if (this._dragRectangleG) {
			this._dragRectangleG.remove();
			this._dragRectangleG = null;
			this._dragRectangle = null;
			this._hidePositionMarker();
		}
	},

	_resetView: function() {
		if (this._map && this._map._isFullscreen) return;
		this._resetDrag();
		this._hidePositionMarker();
		this.fitBounds(this._fullExtent);
	},

	_resizeChart: function() {
		if (this.options.responsive) {
			if (this.options.detached) {
				var newWidth = this.eleDiv.offsetWidth; // - 20;

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

	_showDiagramIndicator: function(item, xCoordinate) {
		if (!this._chartEnabled) return;

		var opts = this.options;
		this._focusG.style("visibility", "visible");

		this._mousefocus.attr('x1', xCoordinate)
			.attr('y1', 0)
			.attr('x2', xCoordinate)
			.attr('y2', this._height())
			.classed('hidden', false);

		var alt = item.z,
			dist = item.dist,
			ll = item.latlng,
			numY = opts.hoverNumber.formatter(alt, opts.hoverNumber.decimalsY),
			numX = opts.hoverNumber.formatter(dist, opts.hoverNumber.decimalsX);

		this._focuslabeltext
			// .attr("x", xCoordinate)
			.attr("y", this._y(item.z))
			.style("font-weight", "700");

		this._focuslabelX
			.text(numX + " " + this._xLabel)
			.attr("x", xCoordinate + 10);

		this._focuslabelY
			.text(numY + " " + this._yLabel)
			.attr("x", xCoordinate + 10);

		var focuslabeltext = this._focuslabeltext.node();
		if (this._isDomVisible(focuslabeltext)) {
			var bbox = focuslabeltext.getBBox();
			var padding = 2;

			this._focuslabelrect
				.attr("x", bbox.x - padding)
				.attr("y", bbox.y - padding)
				.attr("width", bbox.width + (padding * 2))
				.attr("height", bbox.height + (padding * 2));

			// move focus label to left
			if (xCoordinate >= this._width() / 2) {
				this._focuslabelrect.attr("x", this._focuslabelrect.attr("x") - this._focuslabelrect.attr("width") - (padding * 2) - 10);
				this._focuslabelX.attr("x", this._focuslabelX.attr("x") - this._focuslabelrect.attr("width") - (padding * 2) - 10);
				this._focuslabelY.attr("x", this._focuslabelY.attr("x") - this._focuslabelrect.attr("width") - (padding * 2) - 10);
			}
		}

	},

	_toggle: function() {
		if (L.DomUtil.hasClass(this._container, "elevation-expanded"))
			this._collapse();
		else
			this._expand();
	},

	_setMapView: function(item) {
		if (!this.options.followMarker || !this._map) return;
		var zoom = this._map.getZoom();
		zoom = zoom < this._zFollow ? this._zFollow : zoom;
		this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
	},

	_showPositionMarker: function(item) {
		this._selectedItem = item;

		if (this._map && !this._map.getPane('elevationPane')) {
			this._map.createPane('elevationPane');
			this._map.getPane('elevationPane').style.zIndex = 625; // This pane is above markers but below popups.
			this._map.getPane('elevationPane').style.pointerEvents = 'none';
		}

		if (this.options.marker == 'elevation-line') {
			this._updatePositionMarker(item);
		} else if (this.options.marker == 'position-marker') {
			this._updateLeafletMarker(item);
		}
	},

	_updateAxis: function() {
		this._grid.selectAll("g").remove();
		this._axis.selectAll("g").remove();
		this._appendXGrid(this._grid);
		this._appendYGrid(this._grid);
		this._appendXaxis(this._axis);
		this._appendYaxis(this._axis);
	},

	_updateHeightIndicator: function(item) {
		var opts = this.options;

		var numY = opts.hoverNumber.formatter(item.z, opts.hoverNumber.decimalsY),
			numX = opts.hoverNumber.formatter(item.dist, opts.hoverNumber.decimalsX);

		var normalizedAlt = this._height() / this._maxElevation * item.z,
			normalizedY = item.y - normalizedAlt;

		this._mouseHeightFocus
			.attr("x1", item.x)
			.attr("x2", item.x)
			.attr("y1", item.y)
			.attr("y2", normalizedY)
			.style("visibility", "visible");

		this._mouseHeightFocusLabel
			.attr("x", item.x)
			.attr("y", normalizedY)
			.text(numY + " " + this._yLabel)
			.style("visibility", "visible");
	},

	_updateLeafletMarker: function(item) {
		var ll = item.latlng;

		if (!this._marker) {
			this._marker = new L.Marker(ll, {
				icon: this.options.markerIcon,
				zIndexOffset: 1000000,
			});
			this._marker.addTo(this._map, {
				pane: 'elevationPane',
			});
		} else {
			this._marker.setLatLng(ll);
		}
	},

	_updatePointG: function(item) {
		this._pointG
			.attr("transform", "translate(" + item.x + "," + item.y + ")")
			.style("visibility", "visible");
	},

	_updatePositionMarker: function(item) {
		var point = this._map.latLngToLayerPoint(item.latlng);
		var layerpoint = {
			dist: item.dist,
			x: point.x,
			y: point.y,
			z: item.z,
		};

		if (!this._mouseHeightFocus) {
			L.svg({ pane: "elevationPane" }).addTo(this._map); // default leaflet svg renderer
			var layerpane = d3.select(this._map.getContainer()).select(".leaflet-elevation-pane svg");
			this._appendPositionMarker(layerpane);
		}

		this._updatePointG(layerpoint);
		this._updateHeightIndicator(layerpoint);
	},

	_updateSummary: function() {
		if (this.options.summary && this.summaryDiv) {
			this.track_info = this.track_info || {};
			this.track_info.distance = this._distance || 0;
			this.track_info.elevation_max = this._maxElevation || 0;
			this.track_info.elevation_min = this._minElevation || 0;
			d3.select(this.summaryDiv).html('<span class="totlen"><span class="summarylabel">Total Length: </span><span class="summaryvalue">' + this.track_info.distance.toFixed(2) + ' ' + this._xLabel + '</span></span><span class="maxele"><span class="summarylabel">Max Elevation: </span><span class="summaryvalue">' + this.track_info.elevation_max.toFixed(2) + ' ' + this._yLabel + '</span></span><span class="minele"><span class="summarylabel">Min Elevation: </span><span class="summaryvalue">' + this.track_info.elevation_min.toFixed(2) + ' ' + this._yLabel + '</span></span>');
		}
		if (this.options.downloadLink && this._downloadURL) { // TODO: generate dynamically file content instead of using static file urls.
			var span = document.createElement('span');
			span.className = 'download';
			var save = document.createElement('a');
			save.innerHTML = "Download";
			save.href = "#";
			save.onclick = function(e) {
				e.preventDefault();
				var evt = { confirm: this._saveFile.bind(this, this._downloadURL) };
				var type = this.options.downloadLink;
				if (type == 'modal') {
					if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("eletrack_download", { detail: evt }));
					if (this.fire) this.fire('eletrack_download', evt);
					if (this._map) this._map.fire('eletrack_download', evt);
				} else if (type == 'link' || type === true) {
					evt.confirm();
				}
			}.bind(this);

			this.summaryDiv.appendChild(span).appendChild(save);
		}
	},

	_width: function() {
		var opts = this.options;
		return opts.width - opts.margins.left - opts.margins.right;
	},

});

L.control.elevation = function(options) {
	return new L.Control.Elevation(options);
};
