(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
}((function () { 'use strict';

    // Following https://github.com/Leaflet/Leaflet/blob/master/PLUGIN-GUIDE.md
    (function (factory, window) {

        // define an AMD module that relies on 'leaflet'
        if (typeof define === 'function' && define.amd) {
            define(['leaflet'], factory);

            // define a Common JS module that relies on 'leaflet'
        } else if (typeof exports === 'object') {
            module.exports = factory(require('leaflet'));
        }

        // attach your plugin to the global 'L' variable
        if (typeof window !== 'undefined' && window.L) {
            factory(window.L);

        }
    }(function (L) {
        L.locales = {};
        L.locale = null;
        L.registerLocale = function registerLocale(code, locale) {
            L.locales[code] = L.Util.extend({}, L.locales[code], locale);
        };
        L.setLocale = function setLocale(code) {
            L.locale = code;
        };
        return L.i18n = L._ = function translate(string, data) {
            if (L.locale && L.locales[L.locale] && L.locales[L.locale][string]) {
                string = L.locales[L.locale][string];
            }
            try {
                // Do not fail if some data is missing
                // a bad translation should not break the app
                string = L.Util.template(string, data);
            }
            catch (err) {/*pass*/
            }

            return string;
        };
    }, window));

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
    		L.Control.Elevation._d3LazyLoader = this._lazyLoadJS(
    			'https://unpkg.com/d3@5.15.0/dist/d3.min.js',
    			typeof d3 !== 'object',
    			L.Control.Elevation._d3LazyLoader
    		).then(
    			function(d, layer) {
    				this._addData(d);

    				if (this._container) {
    					this._applyData();
    				}
    				if ((typeof layer === "undefined" || layer === null) && d.on) {
    					layer = d;
    				}
    				if (layer) {
    					if (layer._path) {
    						L.DomUtil.addClass(layer._path, this.options.polyline.className + ' ' + this.options.theme);
    					}
    					layer
    						.on("mousemove", this._mousemoveLayerHandler, this)
    						.on("mouseout", this._mouseoutHandler, this);
    				}

    				this.track_info = L.extend({}, this.track_info, {
    					distance: this._distance,
    					elevation_max: this._maxElevation,
    					elevation_min: this._minElevation
    				});

    				this._layers = this._layers || {};
    				this._layers[L.Util.stamp(layer)] = layer;

    				this._fireEvt("eledata_added", { data: d, layer: layer, track_info: this.track_info }, true);
    			}.bind(this, d, layer));
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
    		this.options = this._deepMerge({}, this.options, options);

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

    		this.on('waypoint_added', function(e) {
    			if (e.point._popup) {
    				e.point._popup.options.className = 'elevation-popup';
    				e.point._popup._content = decodeURI(e.point._popup._content);
    			}
    			if (e.point._popup && e.point._popup._content) {
    				e.point.bindTooltip(e.point._popup._content, { direction: 'top', sticky: true, opacity: 1, className: 'elevation-tooltip' }).openTooltip();
    			}
    		});
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
    		} else if (this._isXMLDoc(data)) {
    			this.loadGPX(data);
    		} else if (this._isJSONDoc(data)) {
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
    		if (document.readyState !== 'complete') window.addEventListener("load", L.bind(this.loadData, this, data, opts), { once: true });
    		else this.loadData(data, opts);
    	},

    	/**
    	 * Load data from a remote url.
    	 */
    	loadFile: function(url) {
    		this._downloadURL = url; // TODO: handle multiple urls?
    		try {
    			let xhr = new XMLHttpRequest();
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

    	/**
    	 * Load raw GeoJSON data.
    	 */
    	loadGeoJSON: function(data) {
    		if (typeof data === "string") {
    			data = JSON.parse(data);
    		}

    		this.layer = this.geojson = L.geoJson(data, {
    			style: function(feature) {
    				let style = L.extend({}, this.options.polyline);
    				if (this.options.theme) {
    					style.className += ' ' + this.options.theme;
    				}
    				return style;
    			}.bind(this),
    			pointToLayer: function(feature, latlng) {
    				let marker = L.marker(latlng, { icon: this.options.gpxOptions.marker_options.wptIcons[''] });
    				let desc = feature.properties.desc ? feature.properties.desc : '';
    				let name = feature.properties.name ? feature.properties.name : '';
    				if (name || desc) {
    					marker.bindPopup("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : '')).openPopup();
    				}
    				this.fire('waypoint_added', { point: marker, point_type: 'waypoint', element: latlng });
    				return marker;
    			}.bind(this),
    			onEachFeature: function(feature, layer) {
    				if (feature.geometry.type == 'Point') return;

    				this.addData(feature, layer);

    				this.track_info = L.extend({}, this.track_info, { type: "geojson", name: data.name });
    			}.bind(this),
    		});
    		if (this._map) {
    			this._map.once('layeradd', function(e) {
    				this.fitBounds(this.layer.getBounds());
    				this._fireEvt("eledata_loaded", { data: data, layer: this.layer, name: this.track_info.name, track_info: this.track_info }, true);
    			}, this);

    			this.layer.addTo(this._map);
    		} else {
    			console.warn("Undefined elevation map object");
    		}
    	},

    	/**
    	 * Load raw GPX data.
    	 */
    	loadGPX: function(data) {
    		L.Control.Elevation._gpxLazyLoader = this._lazyLoadJS(
    			'https://unpkg.com/leaflet-gpx@1.5.0/gpx.js',
    			typeof L.GPX !== 'function',
    			L.Control.Elevation._gpxLazyLoader
    		).then(
    			function(data) {
    				this.options.gpxOptions.polyline_options = L.extend({}, this.options.polyline, this.options.gpxOptions.polyline_options);

    				if (this.options.theme) {
    					this.options.gpxOptions.polyline_options.className += ' ' + this.options.theme;
    				}

    				this.layer = this.gpx = new L.GPX(data, this.options.gpxOptions);

    				this.layer.on('loaded', function(e) { this.fitBounds(e.target.getBounds()); }, this);
    				this.layer.on('addpoint', function(e) { this.fire("waypoint_added", e, true); }, this);
    				this.layer.once("addline", function(e) {
    					this.addData(e.line /*, this.layer*/ );

    					this.track_info = L.extend({}, this.track_info, { type: "gpx", name: this.layer.get_name() });

    					this._fireEvt("eledata_loaded", { data: data, layer: this.layer, name: this.track_info.name, track_info: this.track_info }, true);
    				}, this);

    				if (this._map) {
    					this.layer.addTo(this._map);
    				} else {
    					console.warn("Undefined elevation map object");
    				}
    			}.bind(this, data)
    		);
    	},

    	/**
    	 * Wait for chart container visible before download data.
    	 */
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
    						}, this);
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

    		L.Control.Elevation._d3LazyLoader = this._lazyLoadJS(
    			'https://unpkg.com/d3@5.15.0/dist/d3.min.js',
    			typeof d3 !== 'object',
    			L.Control.Elevation._d3LazyLoader
    		).then(
    			function(map, container) {
    				this._initToggle(container);
    				this._initChart(container);

    				this._applyData();

    				this._map.on('zoom viewreset zoomanim', this._hidePositionMarker, this);
    				this._map.on('resize', this._resetView, this);
    				this._map.on('resize', this._resizeChart, this);
    				this._map.on('mousedown', this._resetDrag, this);

    				this._map.on('eledata_added', this._updateSummary, this);

    				L.DomEvent.on(this._map._container, 'mousewheel', this._resetDrag, this);
    				L.DomEvent.on(this._map._container, 'touchstart', this._resetDrag, this);

    			}.bind(this, map, container)
    		);

    		return container;
    	},

    	/**
    	 * Clean up control code and related event listeners.
    	 * Called on control.remove().
    	 */
    	onRemove: function(map) {
    		this._container = null;
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
    		this._distance = dist;
    		this._maxElevation = eleMax;
    		this._minElevation = eleMin;
    	},

    	/**
    	 * Generate "svg" chart container.
    	 */
    	_appendChart: function(svg) {
    		let g = svg
    			.append("g")
    			.attr("transform", "translate(" + this.options.margins.left + "," + this.options.margins.top + ")");

    		this._appendGrid(g);
    		this._appendAreaPath(g);
    		this._appendAxis(g);
    		this._appendFocusRect(g);
    		this._appendMouseFocusG(g);
    		this._appendLegend(g);
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
    	 * Generate "x-axis".
    	 */
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

    	/**
    	 * Generate "x-grid".
    	 */
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

    	/**
    	 * Generate "y-axis".
    	 */
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

    	/**
    	 * Generate "y-grid".
    	 */
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

    	/**
    	 * Generate "path".
    	 */
    	_appendAreaPath: function(g) {
    		this._areapath = g.append("path")
    			.attr("class", "area");
    	},

    	/**
    	 * Generate "axis".
    	 */
    	_appendAxis: function(g) {
    		this._axis = g.append("g")
    			.attr("class", "axis");
    		this._appendXaxis(this._axis);
    		this._appendYaxis(this._axis);
    	},

    	/**
    	 * Generate "mouse-focus" and "drag-rect".
    	 */
    	_appendFocusRect: function(g) {
    		let focusRect = this._focusRect = g.append("rect")
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

    	/**
    	 * Generate "grid".
    	 */
    	_appendGrid: function(g) {
    		this._grid = g.append("g")
    			.attr("class", "grid");
    		this._appendXGrid(this._grid);
    		this._appendYGrid(this._grid);
    	},

    	/**
    	 * Generate "mouse-focus".
    	 */
    	_appendMouseFocusG: function(g) {
    		let focusG = this._focusG = g.append("g")
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

    	/**
    	 * Generate "legend".
    	 */
    	_appendLegend: function(g) {
    		if (!this.options.legend) return;

    		let legend = this._legend = g.append('g')
    			.attr("class", "legend");

    		let altitude = this._altitudeLegend = this._legend.append('g')
    			.attr("class", "legend-altitude");

    		altitude.append("rect")
    			.attr("class", "area")
    			.attr("x", (this._width() / 2) - 50)
    			.attr("y", this._height() + this.options.margins.bottom - 17)
    			.attr("width", 50)
    			.attr("height", 5)
    			.attr("opacity", 0.75);

    		altitude.append('text')
    			.text(L._('Altitude'))
    			.attr("x", (this._width() / 2) + 5)
    			.attr("font-size", 10)
    			.style("text-decoration-thickness", "2px")
    			.style("font-weight", "700")
    			.attr('y', this._height() + this.options.margins.bottom - 11);

    		// autotoggle chart data on single click
    		legend.on('click', function() {
    			if (this._chartEnabled) {
    				this._clearChart();
    				this._clearPath();
    				this._chartEnabled = false;
    			} else {
    				this._resizeChart();
    				for (let id in this._layers) {
    					L.DomUtil.addClass(this._layers[id]._path, this.options.polyline.className + ' ' + this.options.theme);
    				}
    				this._chartEnabled = true;
    			}
    		}.bind(this));

    	},

    	/**
    	 * Generate "svg:line".
    	 */
    	_appendPositionMarker: function(pane) {
    		let theme = this.options.theme;
    		let heightG = pane.select("g");

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

    	/**
    	 * Calculates [x, y] domain and then update chart.
    	 */
    	_applyData: function() {
    		if (!this._data) return;

    		let xdomain = d3.extent(this._data, d => d.dist);
    		let ydomain = d3.extent(this._data, d => d.z);
    		let opts = this.options;

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

    		let ext = new L.latLngBounds(data[0].latlng, data[0].latlng);

    		data.forEach(item => ext.extend(item.latlng));

    		return ext;
    	},

    	/*
    	 * Reset chart.
    	 */
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
    	 * Reset data.
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

    	/*
    	 * Reset path.
    	 */
    	_clearPath: function() {
    		this._hidePositionMarker();
    		for (let id in this._layers) {
    			L.DomUtil.removeClass(this._layers[id]._path, this.options.polyline.className);
    			L.DomUtil.removeClass(this._layers[id]._path, this.options.theme);
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

    	/**
    	 * Recursive deep merge objects.
    	 * Alternative to L.Util.setOptions(this, options).
    	 */
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
    		if (!this._dragStartCoords || !this._draggingEnabled) {
    			return;
    		}

    		let dragEndCoords = this._dragCurrentCoords = d3.mouse(this._focusRect.node());

    		let x1 = Math.min(this._dragStartCoords[0], dragEndCoords[0]);
    		let x2 = Math.max(this._dragStartCoords[0], dragEndCoords[0]);

    		if (!this._dragRectangle && !this._dragRectangleG) {
    			let g = d3.select(this._container).select("svg").select("g");

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
    		let data = this._data ? this._data : [0, 1];
    		let bisect = d3.bisector(d => d.dist).left;
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

    	/*
    	 * Fromatting funciton using the given decimals and seperator
    	 */
    	_formatter: function(num, dec, sep) {
    		let res = L.Util.formatNum(num, dec).toString();
    		let numbers = res.split(".");
    		if (numbers[1]) {
    			for (let d = dec - numbers[1].length; d > 0; d--) {
    				numbers[1] += "0";
    			}
    			res = numbers.join(sep || ".");
    		}
    		return res;
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

    	/**
    	 * Generate "svg" chart DOM element.
    	 */
    	_initChart: function() {
    		let opts = this.options;
    		opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
    		opts.yTicks = opts.yTicks || Math.round(this._height() / 30);
    		opts.hoverNumber.formatter = opts.hoverNumber.formatter || this._formatter;

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

    		let x = this._x = d3.scaleLinear().range([0, this._width()]);
    		let y = this._y = d3.scaleLinear().range([this._height(), 0]);

    		let interpolation = typeof opts.interpolation === 'function' ? opts.interpolation : d3[opts.interpolation];

    		let area = this._area = d3.area().curve(interpolation)
    			.x(d => (d.xDiagCoord = x(d.dist)))
    			.y0(this._height())
    			.y1(d => y(d.z));
    		let line = this._line = d3.line()
    			.x(d => d3.mouse(svg.select("g"))[0])
    			.y(d => this._height());

    		let container = d3.select(this._container);

    		let svg = container.append("svg")
    			.attr("class", "background")
    			.attr("width", opts.width)
    			.attr("height", opts.height);

    		let summary = this.summaryDiv = container.append("div")
    			.attr("class", "elevation-summary " + (this.options.summary ? this.options.summary + "-summary" : '')).node();

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
    		}
    	},

    	/**
    	 * Check object type.
    	 */
    	_isObject: function(item) {
    		return (item && typeof item === 'object' && !Array.isArray(item));
    	},

    	/**
    	 * Check JSON object type.
    	 */
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

    	/**
    	 * Check XML object type.
    	 */
    	_isXMLDoc: function(doc, lazy) {
    		lazy = typeof lazy === "undefined" ? true : lazy;
    		if (typeof doc === "string" && lazy) {
    			doc = doc.trim();
    			return doc.indexOf("<") == 0;
    		} else {
    			let documentElement = (doc ? doc.ownerDocument || doc : 0).documentElement;
    			return documentElement ? documentElement.nodeName !== "HTML" : false;
    		}
    	},

    	/**
    	 * Check DOM element visibility.
    	 */
    	_isDomVisible: function(elem) {
    		return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
    	},

    	/**
    	 * Check DOM element viewport visibility.
    	 */
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

    	/**
    	 * Async JS script download.
    	 */
    	_lazyLoadJS: function(url, skip, loader) {
    		if (skip === false || !this.options.lazyLoadJS) {
    			return Promise.resolve();
    		}
    		if (loader instanceof Promise) {
    			return loader;
    		}
    		return new Promise((resolve, reject) => {
    			let tag = document.createElement("script");
    			tag.addEventListener('load', resolve, { once: true });
    			tag.src = url;
    			document.head.appendChild(tag);
    		});
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

    		this._fireEvt("elechart_change", { data: item }, true);
    		this._fireEvt("elechart_hover", { data: item }, true);
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
    		if (this._dragRectangleG) {
    			this._dragRectangleG.remove();
    			this._dragRectangleG = null;
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
    	 * Generate GPX / GeoJSON download event.
    	 */
    	_saveFile: function(fileUrl) {
    		let d = document,
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

    	/**
    	 * Display distance and altitude level ("focus-rect").
    	 */
    	_showDiagramIndicator: function(item, xCoordinate) {
    		if (!this._chartEnabled) return;

    		let opts = this.options;
    		this._focusG.style("visibility", "visible");

    		this._mousefocus.attr('x1', xCoordinate)
    			.attr('y1', 0)
    			.attr('x2', xCoordinate)
    			.attr('y2', this._height())
    			.classed('hidden', false);

    		let alt = item.z,
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

    		let focuslabeltext = this._focuslabeltext.node();
    		if (this._isDomVisible(focuslabeltext)) {
    			let bbox = focuslabeltext.getBBox();
    			let padding = 2;

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

    	/**
    	 * Update chart axis.
    	 */
    	_updateAxis: function() {
    		this._grid.selectAll("g").remove();
    		this._axis.selectAll("g").remove();
    		this._appendXGrid(this._grid);
    		this._appendYGrid(this._grid);
    		this._appendXaxis(this._axis);
    		this._appendYaxis(this._axis);
    	},

    	/**
    	 * Update distance and altitude level ("leaflet-marker").
    	 */
    	_updateHeightIndicator: function(item) {
    		let opts = this.options;

    		let numY = opts.hoverNumber.formatter(item.z, opts.hoverNumber.decimalsY);
    		let numX = opts.hoverNumber.formatter(item.dist, opts.hoverNumber.decimalsX);

    		let normalizedAlt = this._height() / this._maxElevation * item.z;
    		let normalizedY = item.y - normalizedAlt;

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

    	/**
    	 * Update position marker ("leaflet-marker").
    	 */
    	_updateLeafletMarker: function(item) {
    		let ll = item.latlng;

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

    	/**
    	 * Update focus point ("leaflet-marker").
    	 */
    	_updatePointG: function(item) {
    		this._pointG
    			.attr("transform", "translate(" + item.x + "," + item.y + ")")
    			.style("visibility", "visible");
    	},

    	/**
    	 * Update position marker ("leaflet-marker").
    	 */
    	_updatePositionMarker: function(item) {
    		let point = this._map.latLngToLayerPoint(item.latlng);
    		let layerpoint = {
    			dist: item.dist,
    			x: point.x,
    			y: point.y,
    			z: item.z,
    		};

    		if (!this._mouseHeightFocus) {
    			L.svg({ pane: "elevationPane" }).addTo(this._map); // default leaflet svg renderer
    			let layerpane = d3.select(this._map.getContainer()).select(".leaflet-elevation-pane svg");
    			this._appendPositionMarker(layerpane);
    		}

    		this._updatePointG(layerpoint);
    		this._updateHeightIndicator(layerpoint);
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
    			this.summaryDiv.innerHTML += '<span class="totlen"><span class="summarylabel">' + L._("Total Length: ") + '</span><span class="summaryvalue">' + this.track_info.distance.toFixed(2) + ' ' + this._xLabel + '</span></span><span class="maxele"><span class="summarylabel">' + L._("Max Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_max.toFixed(2) + ' ' + this._yLabel + '</span></span><span class="minele"><span class="summarylabel">' + L._("Min Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_min.toFixed(2) + ' ' + this._yLabel + '</span></span>';
    		}
    		if (this.options.downloadLink && this._downloadURL) { // TODO: generate dynamically file content instead of using static file urls.
    			this.summaryDiv.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>';
    			this.summaryDiv.querySelector('.download a').onclick = function(e) {
    				e.preventDefault();
    				let evt = { confirm: this._saveFile.bind(this, this._downloadURL) };
    				let type = this.options.downloadLink;
    				if (type == 'modal') {
    					if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("eletrack_download", { detail: evt }));
    					this._fireEvt('eletrack_download', evt);
    				} else if (type == 'link' || type === true) {
    					evt.confirm();
    				}
    			}.bind(this);
    		}
    	},

    	/**
    	 * Calculates chart width.
    	 */
    	_width: function() {
    		let opts = this.options;
    		return opts.width - opts.margins.left - opts.margins.right;
    	},

    });

    L.control.elevation = function(options) {
    	return new L.Control.Elevation(options);
    };

})));
//# sourceMappingURL=leaflet-elevation.js.map
