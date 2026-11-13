/*
 * Copyright (c) 2019, GPL-3.0+ Project, Raruto
 *
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or
 *  (at your option) any later version.
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

import * as _ from './utils.js';

const Options = {
	autofitBounds: true,
	autohide: false,
	autohideMarker: true,
	almostOver: true,
	altitude: true,
	closeBtn: true,
	collapsed: false,
	detached: true,
	distance: true,
	distanceMarkers: { lazy: true, distance: true, direction: true },
	dragging: !_.mobile,
	downloadLink: 'link',
	elevationDiv: "#elevation-div",
	edgeScale: { bar: true, icon: false, coords: false },
	followMarker: true,
	imperial: false,
	legend: true,
	handlers: ["Distance", "Time", "Altitude", "Slope", "Speed", "Acceleration"],
	hotline: 'elevation',
	marker: 'elevation-line',
	markerIcon: new L.DivIcon({
		className: 'elevation-position-marker',
		html: '<i class="elevation-position-icon"></i>',
		iconSize: [32, 32],
		iconAnchor: [16, 16],
	}),
	position: "topright",
	polyline: {
		className: 'elevation-polyline',
		color: '#000',
		opacity: 0.75,
		weight: 5,
		lineCap: 'round'
	},
	polylineSegments: {
		className: 'elevation-polyline-segments',
		color: '#F00',
		interactive: false,
	},
	preferCanvas: false,
	reverseCoords: false,
	ruler: true,
	theme: "lightblue-theme",
	summary: 'inline',
	slope: false,
	speed: false,
	time: true,
	timeFactor: 3600,
	timestamps: false,
	trkStart: { className: 'start-marker', radius: 6, weight: 2, color: '#fff', fillColor: '#00d800', fillOpacity: 1, interactive: false },
	trkEnd: { className: 'end-marker', radius: 6, weight: 2, color: '#fff', fillColor: '#ff0606', fillOpacity: 1, interactive: false },
	waypoints: true,
	wptIcons: {
		'': new L.DivIcon({
			className: 'elevation-waypoint-marker',
			html: '<i class="elevation-waypoint-icon default"></i>',
			iconSize: [30, 30],
			iconAnchor: [8, 30],
		}),
	},
	wptLabels: true,
	xAttr: "dist",
	xLabel: "km",
	yAttr: "z",
	yLabel: "m",
	zFollow: false,
	zooming: !_.mobile,

	// Quite uncommon and undocumented options
	margins: { top: 30, right: 30, bottom: 30, left: 40 },
	height: (screen.height * 0.3) || 200,
	width: (screen.width * 0.6) || 600,
	xTicks: undefined,
	yTicks: undefined,

	decimalsX: 2,
	decimalsY: 0,
	forceAxisBounds: false,
	interpolation: "curveLinear",
	yAxisMax: undefined,
	yAxisMin: undefined,

	// Prevent CORS issues for relative locations (dynamic import)
	srcFolder: ((document.currentScript && document.currentScript.src) || (import.meta && import.meta.url) || document.baseURI).split("/").slice(0,-1).join("/") + '/',
};

// "leaflet-i18n" fallback
if (!L._ || !L.i18n) {
	L._ = L.i18n = (string, data) => string;
}

export const Elevation = L.Control.Elevation = class extends (L.version.startsWith('1.') ? L.Control.extend({}) : L.Control) {
  static initHooks = true;
  /**
	 * Initialize chart control "options" and "container".
	 */
  constructor(opts) {
    super();

		// Fixes: https://github.com/Raruto/leaflet-elevation/pull/240
		opts = L.Util.setOptions(this, Object.assign({}, _.cloneDeep(Options), opts)); // "deep copy" nested objects (multiple charts)

		this._data           = [];
		this._layers         = new L.FeatureGroup();
		this._markers        = new L.FeatureGroup();
		this._hotline        = new L.FeatureGroup();
		this._circleMarkers  = new L.FeatureGroup();
		this._markedSegments = new L.Polyline([]);
		this._start          = new L.CircleMarker([0,0], (opts.trkStart || Options.trkStart));
		this._end            = new L.CircleMarker([0,0], (opts.trkEnd || Options.trkEnd));
		this._chartEnabled   = true;
		this._yCoordMin      = 0;
		this._yCoordMax      = -Infinity;
		this.track_info      = {};
		//  this.handlers        = [];

		if (opts.followMarker)             this._setMapView = _.throttle(this._setMapView, 300, this);
		if (opts.legend)                   opts.margins.bottom += 30;
		if (opts.theme)                    opts.polylineSegments.className += ' ' + opts.theme;
		if (opts.wptIcons === true)        opts.wptIcons = Options.wptIcons;
		if (opts.distanceMarkers === true) opts.distanceMarkers = Options.distanceMarkers;
		if (opts.trkStart)                 this._start.addTo(this._circleMarkers);
		if (opts.trkEnd)                   this._end.addTo(this._circleMarkers);


		this._markedSegments.setStyle(opts.polylineSegments);

		// Leaflet canvas renderer colors
		Object.assign(_.Colors, opts.colors || {});

		// Various stuff
		this._fixCanvasPaths();
		this._fixTooltipSize();


    this._initialized = true;
    this.callInitHooks();
  }
  callInitHooks() {
    if (!L.version.startsWith('1.') || this._initialized) super.callInitHooks();
  }
  /*
	 * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
	 */
  addData(d, layer) {
		return Promise.resolve().then(() => {
			if (!this._modulesLoaded) {
				return new Promise(resolve => this.once('modules_loaded', () => resolve(this.addData(d, layer))));
			}
			layer = layer ?? (d.on && d);
			this._addData(d);
			this._addLayer(layer);
			this._fireEvt("eledata_added", { data: d, layer: layer, track_info: this.track_info });
		});

	}
  /**
	 * Adds the control to the given map.
	 */
  addTo(map) {
		if (this.options.detached) {
			let parent = _.select(this.options.elevationDiv);
			let eleDiv = this.onAdd(map);
			parent ? _.append(parent, eleDiv) : _.insert(map.getContainer(), eleDiv, 'afterend');
		} else {
			L.Control.prototype.addTo.call(this, map);
		}
		return this;
	}
  /*
	 * Reset data and display
	 */
  clear() {
		if (this._marker)        this._marker.remove();
		if (this._chart)         this._clearChart();
		if (this._layers)        this._clearLayers(this._layers);
		if (this._markers)       this._clearLayers(this._markers);
		if (this._circleMarkers) this._circleMarkers.remove();
		if (this._hotline)       this._hotline.eachLayer(l => l.options.renderer.remove()); // hotfix for: https://github.com/Raruto/leaflet-elevation/issues/233
		if (this._hotline)       this._clearLayers(this._hotline);

		this._data      = [];
		this.track_info = {};
		this._yCoordMin = 0;
		this._yCoordMax = -Infinity;

		this._fireEvt("eledata_clear");

		this._updateChart();
	}
  _clearChart() {
		this.off('elechart_updated');
		if (this._chart && this._chart._container) {
			this._chart._container.querySelectorAll('g.point .point').forEach(node => node.remove());
			this._clearChartContent();
		}
	}
  _clearLayers(l) {
		l = l || this._layers;
		if (l && l.eachLayer) {
			l.eachLayer(f => f.remove())
			l.clearLayers();
		}
	}
  /**
	 * TODO: Create a base class to handle custom data attributes (heart rate, cadence, temperature, ...)
	 *
	 * @link https://leafletjs.com/examples/extending/extending-3-controls.html#handlers
	 */
	// addHandler(name, HandlerClass) {
	// 	if (HandlerClass) {
	// 		let handler = this[name] = new HandlerClass(this);
	// 		this.handlers.push(handler);
	// 		if (this.options[name]) {
	// 			handler.enable();
	// 		}
	// 	}
	// 	return this;
	// },

	/**
	 * Disable chart brushing.
	 */
  disableBrush() {
		this._chart._brushEnabled = false;
		this._resetDrag();
	}
  /**
	 * Enable chart brushing.
	 */
  enableBrush() {
		this._chart._brushEnabled = true;
	}
  /**
	 * Disable chart zooming.
	 */
  disableZoom() {
		this._chart._zoomEnabled = false;
		this._resetZoom();
	}
  /**
	 * Enable chart zooming.
	 */
  enableZoom() {
		this._chart._zoomEnabled = true;
	}
  /**
	 * Sets a map view that contains the given geographical bounds.
	 */
  fitBounds(bounds) {
		bounds = bounds || this.getBounds();
		if (this._map && bounds.isValid()) this._map.fitBounds(bounds);
	}
  getBounds(data) {
		return new L.LatLngBounds((data || this._data).map((d) => d.latlng));
	}
  /**
	 * Get default zoom level (followMarker: true).
	 */
  getZFollow() {
		return this.options.zFollow;
	}
  /**
	 * Hide current elevation chart profile.
	 */
  hide() {
		_.style(this._container, "display", "none");
	}
  /**
	 * Javascript scripts downloader (lazy loader)
	 */
  import(src, condition) {
		if (Array.isArray(src)) {
			return Promise.all(src.map(m => this.import(m)));
		}
		switch(src) {
			case this.__TOGEOJSON:   condition = typeof toGeoJSON !== 'object'; break;
			case this.__LDISTANCEM:  condition = typeof L.DistanceMarkers  !== 'function'; break;
			case this.__LEDGESCALE:  condition = typeof L.Control.EdgeScale !== 'function'; break;
			case this.__LHOTLINE:    condition = typeof L.Hotline  !== 'function'; break;
		}
		return condition !== false ? import(_.resolveURL(src, this.options.srcFolder)) : Promise.resolve();
	}
  /**
	 * Load elevation data (GPX, GeoJSON, KML or TCX).
	 */
  load(data) {
		this._parseFromString(data).then( geojson => geojson ? this._loadLayer(geojson) : this._loadFile(data));
	}
  /**
	 * Create container DOM element and related event listeners.
	 * Called on control.addTo(map).
	 */
  onAdd(map) {
		this._map = map;

		let container = this._container = _.create("div", "elevation-control " + this.options.theme + " " + (this.options.detached ? 'elevation-detached' : 'leaflet-control'), this.options.detached ? { id: 'elevation-' + _.randomId() } : {});

		this.eleDiv = container;

		this._loadModules(this.options.handlers).then(() => { // Inject here required modules (data handlers)
			this._initChart(container);
			this._initButton(container);
			this._initLayer(map);
			this._modulesLoaded = true;
			this.fire('modules_loaded');
		});



		this.fire('add');

		return container;
	}
  /**
	 * Clean up control code and related event listeners.
	 * Called on control.remove().
	 */
  onRemove(map) {
		this._container = null;

		map
			.off('zoom viewreset zoomanim',      this._hideMarker,    this)
			.off('resize',                       this._resetView,     this)
			.off('resize',                       this._resizeChart,   this)
			.off('mousedown',                    this._resetDrag,     this);

		_.off(map.getContainer(), 'mousewheel',  this._resetDrag,     this);
		_.off(map.getContainer(), 'touchstart',  this._resetDrag,     this);
		_.off(document,           'keydown',     this._onKeyDown,     this);

		this
			.off('eledata_added eledata_loaded', this._updateChart,   this)
			.off('eledata_added eledata_loaded', this._updateSummary, this)
			.off('reset_drag',      this._hideMarker,    this)
			.off('mouse_enter',     this._onMouseEnter,  this)
			.off('dragged',         this._onDragEnd,     this)
			.off('mouse_move',      this._onMouseMove,   this)
			.off('mouse_out',       this._onMouseOut,    this)
			.off('ruler_filter',    this._onRulerFilter, this)
			.off('zoom',            this._updateChart,   this)
			.off('elepath_toggle',  this._onToggleChart, this)
			.off('margins_updated', this._resizeChart,   this);

		this.fire('remove');
	}
  /**
	 * Redraws the chart control. Sometimes useful after screen resize.
	 */
  redraw() {
		this._resizeChart();
	}
  /**
	 * Set default zoom level (followMarker: true).
	 */
  setZFollow(zoom) {
		this.options.zFollow = zoom;
	}
  /**
	 * Hide current elevation chart profile.
	 */
  show() {
		_.style(this._container, "display", "block");
	}
  /*
	 * Parsing data either from GPX or GeoJSON and update the diagram data
	 */
  _addData(d) {
		if (!d) {
			return;
		}

		// Standard GeoJSON
		if (d.type === "FeatureCollection" ) {
			return _.each(d.features, feature => this._addData(feature));
		} else if (d.type === "Feature") {
			let geom = d.geometry;
			if (geom) {
				switch (geom.type) {
					case 'LineString':		return this._addGeoJSONData(geom.coordinates, d.properties);
					case 'MultiLineString':	return _.each(geom.coordinates, (coords, i) => this._addGeoJSONData(coords, d.properties, i));
					case 'Point':
					default:				return console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
				}
			}
		}

		// Fallback for leaflet layers (eg. L.Gpx)
		if (d._latlngs) {
			return this._addGeoJSONData(d._latlngs, d.feature && d.feature.properties);
		}

	}
  /*
	 * Parsing of GeoJSON data lines and their elevation in z-coordinate
	 */
  _addGeoJSONData(coords, properties, nestingLevel) {

		// "coordinateProperties" property is generated inside "@tmcw/toGeoJSON"
		let props  = (properties && properties.coordinateProperties) || properties;

		coords.forEach((point, i) => {

			// GARMIN_EXTENSIONS = ["hr", "cad", "atemp", "wtemp", "depth", "course", "bearing"];
			point.meta = point.meta ?? { time: null, ele: null };

			point.prev = (attr) => (attr ? this._data[i > 0 ? i - 1 : 0][attr] : this._data[i > 0 ? i - 1 : 0]);

			this.fire("elepoint_init", { point: point, props: props, id: i, isMulti: nestingLevel });

			this._addPoint(
				point.lat ?? point[1],
				point.lng ?? point[0],
				point.alt ?? point.meta.ele ?? point[2]
			);

			this.fire("elepoint_added", { point: point, index: this._data.length - 1 });

			if (this._yCoordMin > this._data[this._data.length - 1][this.options.yAttr]) this._yCoordMin = this._data[this._data.length - 1][this.options.yAttr];
			if (this._yCoordMax < this._data[this._data.length - 1][this.options.yAttr]) this._yCoordMax = this._data[this._data.length - 1][this.options.yAttr];
		});

		this.fire("eletrack_added", { coords: coords, index: this._data.length - 1 });
	}
  /*
	 * Parse and push a single (x, y, z) point to current elevation profile.
	 */
  _addPoint(x, y, z) {
		if (this.options.reverseCoords) {
			[x, y] = [y, x];
		}

		this._data.push({
			x: x,
			y: y,
			z: z,
			latlng: new L.LatLng(x, y, z)
		});

		this.fire("eledata_updated", { index: this._data.length - 1 });
	}
  _addLayer(layer) {
		if (layer) this._layers.addLayer(layer)
		// Postpone adding the distance markers (lazy: true)
		if (layer && this.options.distanceMarkers && this.options.distanceMarkers.lazy) {
			layer.on('add remove', ({target, type}) => L.DistanceMarkers && target instanceof L.Polyline && target[type + 'DistanceMarkers']());
		}
		return layer;
	}
  _addMarker(marker) {
		if (marker) this._markers.addLayer(marker)
		return marker;
	}
  /**
	 * Initialize "L.AlmostOver" integration
	 *
	 * Inspired by: https://github.com/makinacorpus/Leaflet.AlmostOver
	 */
  _initAlmostOverHandler(map, layer) {
		if (!map || !this.options.almostOver || _.mobile) return Promise.resolve();
		map.almostOver = map.almostOver || {
			_map: map,
			_projectedLayers: new WeakMap(),
			_layers: [],
			_previous: null,
			_lastSample: 0,
			enabled() {
				return !!this._enabled;
			},
			enable() {
				if (this.enabled()) return;
				this._enabled = true;
				if (this._map.options.almostOnMouseMove !== false) this._map.on(L.version.startsWith('1.') ? 'mousemove' : 'pointermove', this._sampleMouseMove, this);
				this._map.on('click dblclick', this._onMouseClick, this);
			},
			disable() {
				if (!this.enabled()) return;
				this._map.off(L.version.startsWith('1.') ? 'mousemove' : 'pointermove', this._sampleMouseMove, this);
				this._map.off('click dblclick', this._onMouseClick, this);
				if (this._previous) this._map.fire('almost:out', { layer: this._previous.layer });
				this._previous = null;
				this._enabled = false;
			},
			addLayer(layer) {
				if (layer.eachLayer) layer.eachLayer(child => this.addLayer(child));
				else if (!this._layers.includes(layer)) {
					this._layers.push(layer);
					this._projectedLayers.delete(layer);
				}
			},
			removeLayer(layer) {
				if (layer.eachLayer) layer.eachLayer(child => this.removeLayer(child));
				else {
					this._layers = this._layers.filter(item => item !== layer);
					this._projectedLayers.delete(layer);
				}
				this._previous = null;
			},
			getClosest(latlng) {
				let closest;
				const maxDistance = this._map.options.almostDistance ?? 25;

				const closestPointOnLayer = (map, layer, latlng, maxDistance, cache) => {
					let closest;
					const zoom = map.getZoom();
					const target = map.project(latlng, zoom);

					function checkPath(points) {
						let closestSquared = closest ? closest.distance * closest.distance : maxDistance * maxDistance;

						for (let i = 1; i < points.length; i++) {
							const start = points[i - 1];
							const end = points[i];
							const point = L.LineUtil.closestPointOnSegment(target, start, end);
							const distanceSquared = (target.x - point.x) ** 2 + (target.y - point.y) ** 2;

							if (distanceSquared <= maxDistance * maxDistance && distanceSquared < closestSquared) {
								closestSquared = distanceSquared;
								closest = {
									layer,
									latlng: map.unproject(point, zoom),
									distance: Math.sqrt(distanceSquared),
								};
							}
						}
					}
					if (layer.eachLayer) {
						layer.eachLayer(child => {
							const match = closestPointOnLayer(map, child, latlng, closest?.distance ?? maxDistance, cache);
							if (match && (!closest || match.distance < closest.distance)) closest = match;
						});
					} else if (layer.getLatLngs) {
						const cached = cache.get(layer);
						if (cached?.zoom === zoom) {
							cached.paths.forEach(checkPath);
						} else {
							const paths = [];
							const collectPaths = (coords) => {
								if (!Array.isArray(coords)) return;
								if (coords.length && Number.isFinite(coords[0]?.lat)) paths.push(coords.map(point => map.project(point, zoom)));
								else coords.forEach(collectPaths);
							}
							collectPaths(layer.getLatLngs());
							cache.set(layer, { zoom, paths });
							paths.forEach(checkPath);
						}
					}
					return closest;
				}

				// ponytail: scans all route segments per sampled move; add a spatial index if large collections become slow.
				for (const layer of this._layers) {
					const match = closestPointOnLayer(this._map, layer, latlng, closest?.distance ?? maxDistance, this._projectedLayers);
					if (match && (!closest || match.distance < closest.distance)) closest = match;
				}

				return closest;
			},
			_sampleMouseMove(event) {
				const now = Date.now();
				if (this._map._animatingZoom || this._map._panAnim?._inProgress ||
					now - this._lastSample < (this._map.options.almostSamplingPeriod ?? 50) || !this._layers.length) return;
				this._lastSample = now;
				this._onMouseMove(event);
			},
			_onMouseMove(event) {
				const closest = this.getClosest(event.latlng);
				if (closest) {
					if (!this._previous || this._previous.layer !== closest.layer) {
						if (this._previous) this._map.fire('almost:out', { layer: this._previous.layer });
						this._map.fire('almost:over', closest);
					}
					this._map.fire('almost:move', closest);
				} else if (this._previous) {
					this._map.fire('almost:out', { layer: this._previous.layer });
				}
				this._previous = closest;
			},
			_onMouseClick(event) {
				const closest = this.getClosest(event.latlng);
				if (closest) this._map.fire(`almost:${event.type}`, closest);
			},
		};
		if (!map.almostOver.enabled() && map.options.almostOver !== false) map.almostOver.enable();
		if (map.almostOver.enabled()) {
			map.almostOver.addLayer(layer);
			map
				.on('almost:move', this._onMouseMoveLayer, this)
				.on('almost:out', this._onMouseOut, this);
			this.once('eledata_clear', () => {
				map.almostOver.removeLayer(layer);
				map
					.off('almost:move', this._onMouseMoveLayer, this)
					.off('almost:out', this._onMouseOut, this);
			});
		}
		return Promise.resolve();
	}
  /**
	 * Initialize "L.DistanceMarkers" integration
	 */
  _initDistanceMarkers() {
		return this.options.distanceMarkers ? this.import(this.__LDISTANCEM) : Promise.resolve();
	}
  /**
	 * Initialize "L.Control.EdgeScale" integration
	 */
  _initEdgeScale(map) {
		return this.options.edgeScale ? this.import(this.__LEDGESCALE)
			.then(() => {
				map.edgeScaleControl = map.edgeScaleControl || L.control.edgeScale('boolean' !== typeof this.options.edgeScale ? this.options.edgeScale : {}).addTo(map);
			}) : Promise.resolve();
	}
  _initHotLine(layer) {
		let prop = typeof this.options.hotline == 'string' ? this.options.hotline : 'elevation';
		return this.options.hotline ? this.import(this.__LHOTLINE)
			.then(() => {
				layer.eachLayer((trkseg) => {
					if (trkseg.feature.geometry.type != "Point") {
						let geo = new L.GeoJSON(trkseg.toGeoJSON(), { coordsToLatLng: (coords) => new L.LatLng(coords[0], coords[1], coords[2] * (this.options.altitudeFactor || 1))});
						let line = L.hotline(geo.toGeoJSON().features[0].geometry.coordinates, {
							renderer: L.Hotline.renderer(),
							min: isFinite(this.track_info[prop + '_min']) ? this.track_info[prop + '_min'] : 0,
							max: isFinite(this.track_info[prop + '_max']) ? this.track_info[prop + '_max'] : 1,
							palette: {
								0.0: '#008800',
								0.5: '#ffff00',
								1.0: '#ff0000'
							},
							weight: 5,
							outlineColor: '#000000',
							outlineWidth: 1
						}).addTo(this._hotline);
						let alpha = trkseg.options.style && trkseg.options.style.opacity || 1;
						trkseg.on('add remove', ({type}) => {
							trkseg.setStyle({opacity: (type == 'add' ? 0 : alpha)});
							line[(type == 'add' ? 'addTo' : 'removeFrom')](trkseg._map);
							if (line._renderer) line._renderer._container.parentElement.insertBefore(line._renderer._container, line._renderer._container.parentElement.firstChild);
						});
					}
				});
			}) : Promise.resolve();
	}
  /**
	 * Initialize "L.AlmostOver" and "L.DistanceMarkers"
	 */
  _initMapIntegrations(layer) {
		let map = this._map;
		if (map) {
			if (this._data.length) {
				this._start.setLatLng(this._data[0].latlng);
				this._end.setLatLng(this._data[this._data.length -1].latlng);
			}
			Promise.all([
				this._initHotLine(layer),
				this._initAlmostOverHandler(map, layer),
				this._initDistanceMarkers(),
				this._initEdgeScale(map),
			]).then(() => {
				if (this.options.polyline) {
					this._layers.addLayer(layer.addTo(map)); // hotfix for: https://github.com/Raruto/leaflet-elevation/issues/233
					this._circleMarkers.addTo(map);
				}
				if (this.options.autofitBounds) {
					this.fitBounds(layer.getBounds());
				}
				map.invalidateSize();
			});
		} else {
			this.once('add', () => this._initMapIntegrations(layer));
		}
	}
  /*
	 * Collapse current chart control.
	 */
  _collapse() {
		_.replaceClass(this._container, 'elevation-expanded', 'elevation-collapsed');
		if (this._map) this._map.invalidateSize();
	}
  /*
	 * Expand current chart control.
	 */
  _expand() {
		_.replaceClass(this._container, 'elevation-collapsed', 'elevation-expanded');
		if (this._map) this._map.invalidateSize();
	}
  /**
	 * Add some basic colors to leaflet canvas renderer (preferCanvas: true).
	 */
  _fixCanvasPaths() {
		let oldProto = L.Canvas.prototype._fillStroke;
		let control  = this;

		let theme      = this.options.theme.split(' ')[0].replace('-theme', '');
		let color      = _.Colors[theme] || {};

		L.Canvas.include({
			_fillStroke(ctx, layer) {
				if (control._layers.hasLayer(layer)) {

					let options    = layer.options;

					options.color  = control._chartEnabled ? (color.line || color.area || theme) : '#000';
					options.stroke = !!options.color;

					oldProto.call(this, ctx, layer);

					if (options.stroke && options.weight !== 0) {
						let oldVal                   = ctx.globalCompositeOperation || 'source-over';
						ctx.globalCompositeOperation = 'destination-over'
						ctx.strokeStyle              = color.outline || '#FFF';
						ctx.lineWidth                = options.weight * 1.75;
						ctx.stroke();
						ctx.globalCompositeOperation = oldVal;
					}

				} else {
					oldProto.call(this, ctx, layer);
				}
			}
		});
	}
  /**
	 * Partial fix for initial tooltip size
	 *
	 * @link https://github.com/Raruto/leaflet-elevation/issues/81#issuecomment-713477050
	 */
  _fixTooltipSize() {
		this.on('elechart_init', () =>
			this.once('elechart_change elechart_hover', ({data, xCoord}) => {
				if (this._chartEnabled) {
					this._showDiagramIndicator(data, xCoord);
					this._showDiagramIndicator(data, xCoord);
				}
				this._updateMarker(data);
			})
		);
	}
  /*
	 * Finds a data entry for the given LatLng
	 */
  _findItemForLatLng(latlng) {
		return this._data[this._findIndexForLatLng(latlng)];
	}
  /*
	 * Finds a data entry for the given xDiagCoord
	 */
  _findItemForX(x) {
		return this._data[this._findIndexForXCoord(x)];
	}
  /**
	 * Fires an event of the specified type.
	 */
  _fireEvt(type, data, propagate) {
		if (this.fire) this.fire(type, data, propagate);
		if (this._map) this._map.fire(type, data, propagate);
	}
  /*
	 * Hides the position/height indicator marker drawn onto the map
	 */
  _hideMarker() {
		if (this.options.autohideMarker && this._marker) {
			this._marker.remove();
		}
	}
  /**
	 * Generate "svg" chart (DOM element).
	 */
  _initChart(container) {
		let opts = this.options;
		let map  = this._map;

		if (opts.detached) {
			let { offsetWidth, offsetHeight}             = this.eleDiv;
			if (offsetWidth > 0)             opts.width  = offsetWidth;
			if (offsetHeight > 20)           opts.height = offsetHeight - 20; // 20 = horizontal scrollbar size.
		} else {
			let { clientWidth }                          = map.getContainer();
			opts._maxWidth                               = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;
			this._container.style.maxWidth               = opts._maxWidth + 'px';
			if (opts._maxWidth > clientWidth) opts.width = clientWidth - 30;
		}

		Promise.resolve().then(() => {

			let chart = this._createChart();

			this._x     = this._chart._x;
			this._y     = this._chart._y;

			container.appendChild(chart._container);
			this._initChartComponents(container);

			this
				.on('reset_drag',      this._hideMarker,     this)
				.on('mouse_enter',     this._onMouseEnter,   this)
				.on('dragged',         this._onDragEnd,      this)
				.on('mouse_move',      this._onMouseMove,    this)
				.on('mouse_out',       this._onMouseOut,     this)
				.on('ruler_filter',    this._onRulerFilter,  this)
				.on('zoom',            this._updateChart,    this)
				.on('elepath_toggle',  this._onToggleChart,  this)
				.on('margins_updated', this._resizeChart,    this);


			this.fire("elechart_init");

			map
				.on('zoom viewreset zoomanim',      this._hideMarker,    this)
				.on('resize',                       this._resetView,     this)
				.on('resize',                       this._resizeChart,   this)
				.on('rotate',                       this._rotateMarker,  this)
				.on('mousedown',                    this._resetDrag,     this);

			_.on(map.getContainer(), 'mousewheel',  this._resetDrag,     this);
			_.on(map.getContainer(), 'touchstart',  this._resetDrag,     this);
			_.on(document,           'keydown',     this._onKeyDown,     this);

			this
				.on('eledata_added eledata_loaded', this._updateChart,   this)
				.on('eledata_added eledata_loaded', this._updateSummary, this);

			this._updateChart();
			this._updateSummary();
			map.invalidateSize();
		});


	}
  _createChart() {
		const opts = this.options, control = this;
		const chartState = this._chart = {};
		chartState.options = opts;
		chartState._data = control._data || [];
		chartState._props = { scales: {}, paths: {}, areas: {}, grids: {}, axes: {}, legendItems: {}, tooltipItems: {} };
		chartState._scales = {};
		chartState._domains = {};
		chartState._ranges = {};
		chartState._paths = {};
		chartState._brushEnabled = opts.dragging;
		chartState._zoomEnabled = opts.zooming;
		chartState.__xTicks = opts.xTicks;
		chartState.__yTicks = opts.yTicks;
		chartState._transform = { k: 1, x: 0 };
		const { width, height, margins = {}, ruler, preferCanvas } = opts;
		const svg = _.create('svg:svg', '', { class: 'background' });
		const defs = _.create('svg:defs', '', {}, svg);
		const g = _.create('svg:g', '', {}, svg);
		const panes = {};
		for (const name of ['grid', 'area', 'axis', 'point', 'brush', 'tooltip', 'ruler', 'legend']) panes[name] = _.create('svg:g', '', { class: name }, g);
		panes.tooltip.setAttribute('display', 'none');
		const mask = _.create('svg:mask', '', { id: 'elevation-clipper-' + _.randomId(), 'fill-opacity': 1 }, panes.area);
		const maskRect = _.create('svg:rect', '', { class: 'zoom', fill: 'white' }, mask);
		const foreignObject = _.create('svg:foreignObject', '', { mask: `url(#${mask.id})` }, panes.area);
		const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		canvas.className = 'canvas-plot';
		foreignObject.appendChild(canvas);
		const context = canvas.getContext('2d');
		const webkitCanvas = preferCanvas && /Mac|iPod|iPhone|iPad/.test(navigator.platform) &&
			/AppleWebkit/i.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
		const canvasImage = webkitCanvas ? _.create('svg:image', '', { mask: `url(#${mask.id})`, 'pointer-events': 'none' }, panes.area) : null;
		if (canvasImage) foreignObject.remove();
		const overlay = _.create('svg:rect', '', { class: 'overlay', fill: 'none', 'pointer-events': 'all' }, panes.brush);
		const selection = _.create('svg:rect', '', { class: 'selection', fill: '#777', 'fill-opacity': 0.3, stroke: '#fff', display: 'none' }, panes.brush);
		for (const edge of ['w', 'e']) _.create('svg:rect', '', { class: `handle handle--${edge}`, fill: 'none', 'pointer-events': 'all', display: 'none', cursor: 'ew-resize' }, panes.brush);
		const chart = chartState._chart = { svg, g, panes, utils: { defs, mask, canvas, context }, pane: name => panes[name] || (panes[name] = _.create('svg:g', '', { class: name }, g)) };
		chart.get = name => chart.utils[name];
		// ponytail: Safari encodes one PNG per redraw; use a separate HTML canvas layer if encoding becomes a bottleneck.
		chart._renderCanvas = () => { if (canvasImage) canvasImage.setAttribute('href', canvas.toDataURL()); };
		chart._resize = ({ width, height, margins = {}, ruler }) => {
			const w = width - margins.left - margins.right, h = height - margins.top - margins.bottom;
			_.setAttributes(svg, { width, height, viewBox: `0 0 ${width} ${height}` });
			g.setAttribute('transform', `translate(${margins.left},${margins.top})`);
			_.setAttributes(maskRect, { width: w, height: h, x: 0, y: 0 });
			_.setAttributes(foreignObject, { width: w, height: h });
			_.setAttributes(canvas, { width: w, height: h });
			if (canvasImage) { _.setAttributes(canvasImage, { width: w, height: h }); canvasImage.removeAttribute('href'); }
			_.setAttributes(overlay, { x: 0, y: 0, width: w, height: h });
			selection.setAttribute('display', 'none');
			for (const handle of panes.brush.querySelectorAll('.handle')) handle.setAttribute('display', 'none');
			if (ruler) {
				const group = panes.ruler;
				group.replaceChildren();
				group.dataset.y = h;
				group.setAttribute('transform', `translate(0,${h})`);
				_.create('svg:rect', '', { class: 'horizontal-drag-rect', x: 0, y: -8, width: w, height: 8, fill: 'none', 'pointer-events': 'all' }, group);
				_.create('svg:line', '', { class: 'horizontal-drag-line', x1: 0, x2: w }, group);
				_.create('svg:text', '', { class: 'horizontal-drag-label', 'text-anchor': 'end', x: w - 8, y: -8 }, group);
				_.create('svg:path', '', { class: 'horizontal-drag-symbol', d: 'M0,-6L5,3L-5,3Z', transform: `translate(${w + 7},0) rotate(-90)` }, group);
			}
			chart._width = w;
			chart._height = h;
			svg.dispatchEvent(new CustomEvent('resize', { detail: { width: w, height: h } }));
		};
		chart._resize({ width, height, margins, ruler });
		chartState._container = chart.svg;
		for (const name of ['grid', 'area', 'point', 'axis', 'legend', 'tooltip', 'ruler']) chartState['_' + name] = chart.pane(name);
		chartState._mask = chart.get('mask');
		chartState._context = chart.get('context');
		this._registerChartAxisScale({ axis: 'x', position: 'bottom', attr: opts.xAttr, min: opts.xAxisMin, max: opts.xAxisMax, name: 'distance' });
		this._registerChartAxisScale({ axis: 'y', position: 'left', attr: opts.yAttr, min: opts.yAxisMin, max: opts.yAxisMax, name: 'altitude' });
		chartState._x = chartState._scales.distance;
		chartState._y = chartState._scales.altitude;
		chartState._maskGaps = [];
		control.on('eletrack_added', ({ index }) => {
			chartState._maskGaps.push(index);
			control.once('elepoint_added', ({ index }) => chartState._maskGaps.push(index));
		});
		const brush = panes.brush;
		const focus = event => {
			if (!chartState.options.detached) event.stopPropagation();
			if (!chartState._data.length) return;
			const xCoord = _.clamp(_.pointer(event, chartState._area)[0], [0, this._width()]);
			control.fire('mouse_move', { item: chartState._data[this._findIndexForXCoord(xCoord)], xCoord });
		};
		const rulerLabel = () => {
			const y = +chartState._ruler.dataset.y;
			if (y <= 0 || y >= this._height()) chartState._ruler.querySelector('text').textContent = '';
			this._hideDiagramIndicator();
		};
		brush.style.touchAction = 'none';
		chartState._ruler.style.touchAction = 'none';
		brush.addEventListener('pointerenter', () => control.fire('mouse_enter'));
		brush.addEventListener('pointerleave', () => { if (!chartState._gesture) control.fire('mouse_out'); });
		brush.addEventListener('pointermove', event => { if (!chartState._gesture) focus(event); });
		brush.addEventListener('mousemove', event => {
			if (!chartState.options.detached) event.stopPropagation();
		});
		svg.addEventListener('pointerdown', event => {
			if (chartState._gesture || !event.isPrimary) return;
			const [x] = _.pointer(event, chartState._area);
			let type;
			if (chartState._ruler.contains(event.target) && chartState.options.ruler && event.button === 0) type = 'ruler';
			else if ((event.shiftKey || event.button === 1) && chartState._zoomEnabled) type = 'pan';
			else if (brush.contains(event.target) && !event.shiftKey && event.button === 0 && chartState._brushEnabled) {
				type = event.target.classList.contains('handle--w') ? 'west' :
					event.target.classList.contains('handle--e') ? 'east' :
					event.target.classList.contains('selection') ? 'move' : 'brush';
			}
			if (!type) return;
			event.preventDefault();
			event.stopPropagation();
			svg.setPointerCapture(event.pointerId);
			chartState._gesture = { type, id: event.pointerId, start: x, selection: chartState._selection?.slice(), transform: { ...chartState._transform } };
			if (type === 'ruler') rulerLabel();
			else if (type === 'pan') svg.style.cursor = 'grabbing';
			else {
				control.fire('mouse_enter');
				if (type === 'brush') this._setSelection([x, x]);
				focus(event);
			}
		});
		svg.addEventListener('pointermove', event => {
			const gesture = chartState._gesture;
			if (!gesture || gesture.id !== event.pointerId) return;
			event.preventDefault();
			const [rawX, rawY] = _.pointer(event, chartState._area);
			const x = _.clamp(rawX, [0, this._width()]);
			if (gesture.type === 'pan') {
				this._setZoom(gesture.transform.k, gesture.transform.x + rawX - gesture.start);
				this._hideDiagramIndicator();
			} else if (gesture.type === 'ruler') {
				const y = _.clamp(rawY, [0, this._height()]);
				chartState._ruler.dataset.y = y;
				chartState._ruler.setAttribute('transform', `translate(0,${y})`);
				chartState._ruler.classList.toggle('active', y < this._height());
				chartState._ruler.querySelector('text').textContent = chartState._y.invert(y).toFixed(0) + ' ' + (chartState.options.imperial ? 'ft' : 'm');
				const groups = [];
				if (rawY > 0 && rawY < this._height()) {
					const altitude = chartState._y.invert(rawY);
					let group;
					for (const item of chartState._data) {
						if (item[chartState.options.yAttr] >= altitude) {
							if (!group) groups.push(group = []);
							group.push(item.latlng);
						} else group = null;
					}
				}
				control.fire('ruler_filter', { coords: groups });
			} else {
				let selection;
				if (gesture.type === 'move') {
					const delta = _.clamp(x - gesture.start, [-gesture.selection[0], this._width() - gesture.selection[1]]);
					selection = gesture.selection.map(value => value + delta);
				} else if (gesture.type === 'west') selection = [x, gesture.selection[1]];
				else if (gesture.type === 'east') selection = [gesture.selection[0], x];
				else selection = [_.clamp(gesture.start, [0, this._width()]), x];
				this._setSelection(selection);
			}
		});
		const end = event => {
			const gesture = chartState._gesture;
			if (!gesture || gesture.id !== event.pointerId) return;
			chartState._gesture = null;
			svg.style.cursor = '';
			if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
			if (gesture.type === 'ruler') rulerLabel();
			else if (gesture.type !== 'pan') {
				if (event.type === 'pointercancel' || !chartState._selection || chartState._selection[1] - chartState._selection[0] < 1) this._resetChartDrag();
				else if (chartState._data.length) control.fire('dragged', {
					dragstart: chartState._data[this._findIndexForXCoord(chartState._selection[0])],
					dragend: chartState._data[this._findIndexForXCoord(chartState._selection[1])],
				});
			}
			if (event.pointerType === 'touch') control.fire('mouse_out');
		};
		for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(name, end);
		const zoomAt = (event, factor) => {
			if (!chartState._zoomEnabled || !event.shiftKey) return;
			event.preventDefault();
			const x = _.pointer(event, chartState._area)[0];
			const k = _.clamp(chartState._transform.k * factor, [1, 10]);
			this._setZoom(k, x - (x - chartState._transform.x) * k / chartState._transform.k);
		};
		svg.addEventListener('wheel', event => zoomAt(event, 2 ** (-event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))), { passive: false });
		svg.addEventListener('dblclick', event => zoomAt(event, 2));
		svg.addEventListener('legend_clicked', ({ detail: { path, name, legend, enabled } }) => {
			if (!path) return;
			this._togglePath(name, !enabled);
			control.fire('elepath_toggle', { path, name, legend, enabled });
		});
		return chartState;
  }
  _initChartComponents(container) {
		const control = this;
		const map = control._map;
		let pane = map.getPane('elevationPane');
		if (!pane) {
			pane = control._pane = map.createPane('elevationPane', map.getPane('norotatePane') || map.getPane('mapPane'));
			pane.style.zIndex = 625;
			pane.style.pointerEvents = 'none';
		}
		if (control._renderer) control._renderer.remove();
		control._renderer = new L.SVG({ pane: "elevationPane" }).addTo(map);
		const options = this.options;
		const marker = {
			options, control, _labels: {},
			addTo(map) {
				this._map = map;
				switch (this.options.marker) {
					case 'elevation-line':
						this._container = map.getPane('elevationPane').querySelector("svg > g");
						this._container.replaceChildren();
						this._container.setAttribute('class', 'height-focus-group');
					break;
					case 'position-marker': this._marker.addTo(map, { pane: 'overlayPane' }); break;
				}
				return this;
			},
			update(props) {
				if (props) this._props = props;
				else props = this._props;
				if (!props) return;
				if (props.options) this.options = props.options;
				if (!this._map) this.addTo(props.map);
				this._latlng = props.item.latlng;

				switch (this.options.marker) {
					case 'elevation-line':
						if (this._container) {
							let point = this._map.latLngToLayerPoint(this._latlng);
							point = Object.assign({}, props.item, this._map._rotate ? this._map.rotatedPointToMapPanePoint(point) : point);
							let yMin = props.yCoordMin || 0;
							let yMax = (this.control._height() / (props.yCoordMax - yMin) * (point[this.options.yAttr] - yMin));
							if (!isFinite(yMax) || isNaN(yMax)) yMax = 0;
							const { x: xCoord, y: yCoord } = point;
							if (!Number.isFinite(xCoord) || !Number.isFinite(yCoord)) return;
							const group = this._container;
							const { theme } = this.options;
							const length = point.y - yMax;
							group.replaceChildren();
							group.setAttribute('class', 'height-focus-group');
							_.create('svg:circle', '', { class: `${theme} height-focus circle-lower`, transform: `translate(${xCoord},${yCoord})`, r: 6, cx: 0, cy: 0 }, group);
							_.create('svg:line', '', { class: `${theme} height-focus line`, x1: xCoord, x2: xCoord, y1: yCoord, y2: length }, group);
							const text = _.create('svg:text', '', { class: `${theme} height-focus-label`, x: xCoord + 5, y: length, 'pointer-events': 'none' }, group);
							Object.values(this._labels).sort((a, b) => a.order - b.order).forEach(label => {
								_.create('svg:tspan', '', { class: 'height-focus-' + label.name, dy: '1.5em' }, text).textContent =
									typeof label.value === 'function' ? label.value(point) : label.value;
							});
							if (text.firstChild) text.firstChild.setAttribute('dy', text.children.length > 1 ? '-1.5em' : '0em');
							for (const span of text.children) span.setAttribute('x', xCoord + 5);
						}
					break;
					case 'position-marker':
						_.removeClass(this._marker.getElement(), 'leaflet-hidden');
						this._marker.setLatLng(this._latlng);
					break;
				}
			},
			remove() {
				this._props = null;
				switch (this.options.marker) {
					case 'elevation-line': this._container && this._container.classList.add("leaflet-hidden"); break;
					case 'position-marker': _.addClass(this._marker.getElement(), 'leaflet-hidden'); break;
				}
			},
			getLatLng() {
				return this._latlng;
			},
			_registerTooltip(props) {
				this._labels[props.name] = props;
			},
		};
		if (options.marker === 'position-marker') {
			marker._marker = new L.Marker([0, 0], { icon: options.markerIcon, zIndexOffset: 1000000, interactive: false });
		}
		control._marker = this._chart._marker = marker;
		control.fire("elechart_marker");
		const opts = { summary: this.options.summary };
		const summary = {
			options: opts, control, labels: {},
			_container: _.create("div", "elevation-summary " + (opts.summary ? opts.summary + "-summary" : '')),
			render() {
				return container => container.appendChild(this._container);
			},
			reset() {
				this._container.innerHTML = '';
			},
			append(className, label, value) {
				this._container.innerHTML += `<span class="${className}"><span class="summarylabel">${label}</span><span class="summaryvalue">${value}</span></span>`;
				return this;
			},
			update() {
				Object.keys(this.labels).sort((a, b) => this.labels[a].order - this.labels[b].order).forEach((i) => {
					let value = typeof this.labels[i].value !== "function" ? this.labels[i].value : this.labels[i].value(this.control.track_info, this.labels[i].unit || '');
					this.append(i, L._(this.labels[i].label), value, this.labels[i].order);
				});
			},
			_registerSummary(data) {
				for (let i in data) {
					data[i].order = data[i].order ?? 1000;
					this.labels[i] = data[i];
				}
			},
		};
		_.style(summary._container, 'max-width', opts.width ? opts.width + 'px' : '');
		control._summary = this._chart._summary = summary;
		this._summary.render()(container);
  }
  _updateChartSummary() {
		const chart = this._chart;
		const control = this;
		const summary = chart._summary;
		summary.reset();
		if (control.options.summary) {
			control.fire("elechart_summary");
			summary.update();
		}
		if (control.options.downloadLink && control._downloadURL) {
			summary._container.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>';
			_.select('.download a', summary._container).onclick = (e) => {
				e.preventDefault();
				let event = { downloadLink: control.options.downloadLink, confirm: _.saveFile.bind(control, control._downloadURL) };
				if (control.options.downloadLink == 'modal' && typeof CustomEvent === "function") {
					document.dispatchEvent(new CustomEvent("eletrack_download", { detail: event }));
				} else if (control.options.downloadLink == 'link' || control.options.downloadLink === true) {
					event.confirm();
				}
				control.fire('eletrack_download', event);
			};
		}
  }
  _clearChartContent() {
		const chart = this._chart;
		this._resetChartDrag();
		this._hideDiagramIndicator();
		chart._transform = { k: 1, x: 0 };
		chart._container.classList.remove('zoomed');
		chart._point.removeAttribute('mask');
		chart._point.replaceChildren();
		for (const path of Object.values(chart._paths)) path.setAttribute('d', 'M0 0');
		chart._context.clearRect(0, 0, this._width(), this._height());
		chart._chart._renderCanvas();
		chart._mask.querySelectorAll('.gap').forEach(node => node.remove());
		chart._maskGaps = [];
  }
  _hasActiveLayers() {
		const chart = this._chart;
		return Object.values(chart._paths).some(path => !path.classList.contains('leaflet-hidden'));
  }
  _setSelection(values) {
		const chart = this._chart;
		chart._selection = values.map(x => _.clamp(x, [0, this._width()])).sort((a, b) => a - b);
		const [start, end] = chart._selection;
		_.setAttributes(chart._chart.panes.brush.querySelector('.selection'), {
			x: start, y: 0, width: end - start, height: this._height(), display: 'inline', cursor: 'move',
		});
		for (const edge of ['w', 'e']) _.setAttributes(chart._chart.panes.brush.querySelector('.handle--' + edge), {
			x: (edge === 'w' ? start : end) - 3, y: 0, width: 6, height: this._height(), display: 'inline',
		});
  }
  _setZoom(k, x) {
		const chart = this._chart;
		if (!Number.isFinite(k) || !Number.isFinite(x) || k <= 0) throw new Error('Invalid chart zoom');
		k = _.clamp(k, [1, 10]);
		chart._transform = { k, x: _.clamp(x, [this._width() * (1 - k), 0]) };
		chart._container.classList.toggle('zoomed', k !== 1);
		if (k !== 1) chart._point.setAttribute('mask', `url(#${chart._mask.id})`);
		else chart._point.removeAttribute('mask');
		this._resetChartDrag();
		this._updateScale();
		this.fire('zoom');
  }
  _registerChartAreaPath(props) {
		const chart = this._chart;
		props = { xAttr: chart.options.xAttr, yAttr: chart.options.yAttr, preferCanvas: chart.options.preferCanvas, ...props };
		const { name, color, strokeColor, strokeOpacity, fillOpacity, className = '' } = props;
		const path = chart._paths[name] = _.create('svg:path', '', {
			class: `${name || ''} ${className}`,
			fill: color || '#3366CC', stroke: strokeColor || '#000',
			'stroke-opacity': strokeOpacity ?? 1, 'fill-opacity': fillOpacity ?? 0.8,
		});
		path.style.pointerEvents = 'none';
		chart._props.areas[props.name] = props;
		if (chart.options.legend) chart._props.legendItems[props.name] = { ...props, path: chart._paths[props.name] };
  }
  _registerChartAxisGrid(props) {
		const chart = this._chart;
		chart._props.grids[props.name || props.axis] = { ...props };
  }
  _registerChartAxisScale(props) {
		const chart = this._chart;
		props = { ...props };
		const alias = props.scale;
		if (alias === 'y') props.scale = chart._y;
		else if (alias === 'x') props.scale = chart._x;
		if (typeof chart._scales[props.name] === 'function') props.scale = chart._scales[props.name];
		else if (typeof props.scale !== 'function') {
			const scale = { data: chart._data, forceBounds: chart.options.forceAxisBounds, ...props.scale };
			scale.attr = scale.attr || props.name;
			const { min, max, attr, name, forceBounds, scale: domainScale } = { forceBounds: scale.forceBounds, ...props };
			const key = (domainScale && domainScale.attr) || attr || name;
			chart._domains[props.name] = data => {
				let low = Infinity, high = -Infinity;
				for (const point of data || []) {
					const value = point[key];
					if (value == null || !Number.isFinite(+value)) continue;
					low = Math.min(low, +value);
					high = Math.max(high, +value);
				}
				if (low === Infinity) [low, high] = [0, 1];
				if (min !== undefined && (min < low || forceBounds)) low = +min;
				if (max !== undefined && (max > high || forceBounds)) high = +max;
				return [low, high];
			};

			chart._ranges[props.name] = (width, height) => props.axis === 'x' ? [0, width] : [height, 0];
			scale.range = scale.range || chart._ranges[props.name](this._width(), this._height());
			scale.domain = scale.domain || chart._domains[props.name](chart._data);
			chart._props.scales[props.name] = scale;
			const Scale = function({ domain, range }) {
				let bounds = domain;
				let pixels = range;
				const interpolate = (value, from, to) => {
					const fraction = from[1] === from[0] ? 0.5 : (value - from[0]) / (from[1] - from[0]);
					return to[0] + fraction * (to[1] - to[0]);
				};
				const scale = value => value == null ? undefined : interpolate(+value, bounds, pixels);
				scale.invert = value => interpolate(+value, pixels, bounds);
				scale.domain = function(value) {
					if (!arguments.length) return bounds.slice();
					bounds = value.map(Number);
					return scale;
				};
				scale.range = function(value) {
					if (!arguments.length) return pixels.slice();
					pixels = value.map(Number);
					return scale;
				};
				scale.copy = () => Scale({ domain: bounds.slice(), range: pixels.slice() });
				scale.ticks = (count = 10) => {
					const [low, high] = [Math.min(...bounds), Math.max(...bounds)];
					if (!(count > 0) || !Number.isFinite(low + high)) return [];
					if (low === high) return [low];
					const raw = (high - low) / count;
					const power = 10 ** Math.floor(Math.log10(raw));
					const error = raw / power;
					const step = power * (error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1);
					const first = Math.ceil(low / step), last = Math.floor(high / step);
					const values = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => +( (first + i) * step).toPrecision(14));
					return bounds[0] > bounds[1] ? values.reverse() : values;
				};
				return scale;
			};
			props.scale = chart._scales[props.name] = Scale(scale);
		} else if (alias === 'x' || alias === 'y') {
			// Aliases share the original scale, including its zoomed domain.
			chart._scales[props.name] = props.scale;
		}
		if (!props.ticks) props.ticks = (props.axis === 'x' ? this._xTicks : this._yTicks).bind(this);
		chart._props.axes[props.name] = props;
		if (props.name === chart.options.yScale) chart._y = props.scale;
		if (props.name === chart.options.xScale) chart._x = props.scale;
		return props.scale;
  }
  _registerChartCheckPoint(point) {
		const chart = this._chart;
		if (!chart._data.length) return;
		const { xAttr, yAttr } = chart.options;
		let item, x;
		if (point.latlng) {
			item = chart._data[this._findIndexForLatLng(point.latlng)];
			x = chart._x(item[xAttr]);
		} else if (!isNaN(point[xAttr])) {
			x = chart._x(point[xAttr]);
			item = chart._data[this._findIndexForXCoord(x)];
		}
		if (!item) return;
		const y = chart._y(item[yAttr]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		if (!point.item?.isConnected) {
			point.position = point.position || 'bottom';
			point.item = _.create('svg:g', '', {}, chart._point);
			_.create('svg:line', '', { x1: 0, y1: 0, style: 'stroke: rgb(51, 51, 51); stroke-width: 0.5; stroke-dasharray: 2, 2;' }, point.item);
			_.create('svg:circle', '', { class: 'height-focus circle-lower', r: 3 }, point.item);
			if (point.label) _.create('svg:text', '', { dx: '4px', dy: '-4px' }, point.item);
		}
		_.setAttributes(point.item, { class: 'point ' + point.position, transform: `translate(${x},${y})`, 'data-y': y });
		_.setAttributes(point.item.querySelector('line'), { y2: ({ top: -y, bottom: this._height() - y })[point.position],
			x2: ({ left: -x, right: this._width() - x })[point.position] || 0 });
		if (point.label) point.item.querySelector('text').textContent = point.label;
  }
  _registerChartTooltip(props) {
		const chart = this._chart;
		props.order = props.order ?? 1000;
		chart._props.tooltipItems[props.name] = props;
  }
  _updateArea() {
		const chart = this._chart;
		chart._context.clearRect(0, 0, this._width(), this._height());
		for (const name in chart._paths) {
			const path = chart._paths[name], area = chart._props.areas[name];
			if (path.classList.contains('leaflet-hidden')) continue;
			const { xAttr, yAttr, interpolation = 'curveLinear' } = { interpolation: chart.options.interpolation, ...area };
			const scaleX = chart._scales[area.scaleX], scaleY = chart._scales[area.scaleY];
			if (!['curveLinear', 'curveStep', 'curveStepBefore', 'curveStepAfter'].includes(interpolation)) {
				throw new Error(`Unsupported interpolation "${interpolation}". Use curveLinear, curveStep, curveStepBefore or curveStepAfter.`);
			}
			let outline = '';
			if (chart._data.length) {
				const points = chart._data.map(d => [d.xDiagCoord = scaleX(d[xAttr]), scaleY(d[yAttr])]);
				outline = `M${points[0]}`;
				for (let i = 1; i < points.length; i++) {
					const [x, y] = points[i], [previousX] = points[i - 1];
					if (interpolation === 'curveStepBefore') outline += `V${y}H${x}`;
					else if (interpolation === 'curveStepAfter') outline += `H${x}V${y}`;
					else if (interpolation === 'curveStep') outline += `H${(previousX + x) / 2}V${y}H${x}`;
					else outline += `L${x},${y}`;
				}
				outline += `L${points.at(-1)[0]},${this._height()}L${points[0][0]},${this._height()}Z`;
			}
			path.setAttribute('d', outline);
			if (chart.options.preferCanvas) _.drawCanvas(chart._context, path);
			else chart._area.appendChild(path);
		}
		chart._chart._renderCanvas();
  }
  _renderChart(props) {
		const chart = this._chart;
		if (props?.data) chart._data = props.data;
		if (props?.options) chart.options = props.options;
		chart.options.xTicks = this._xTicks();
		chart.options.yTicks = this._yTicks();
		this._updateScale();
		chart._grid.replaceChildren();
		chart._axis.replaceChildren();
		const entries = [
			...Object.entries(chart._props.grids).map(([name, props]) => [name, { tickFormat: '', ...props, type: 'grid' }, chart._grid]),
			...Object.entries(chart._props.axes).map(([name, props]) => [name, props, chart._axis]),
		];
		for (const [key, props, parent] of entries) {
			if (chart.options[key] === false || chart.options[key] === 'summary') continue;
			const {
				type = 'axis', tickSize = 6, tickPadding = 3, position, height, width,
				axis, ticks, tickFormat, label, labelX, labelY, name = '', onAxisMount,
			} = { width: this._width(), height: this._height(), ...props };
			const scale = props.scale === 'x' ? chart._x : props.scale === 'y' ? chart._y : props.scale;
			const horizontal = axis === 'x';
			const sign = position === 'top' || position === 'left' ? -1 : 1;
			const size = type === 'grid' ? horizontal ? -height : -width : tickSize;
			const group = _.create('svg:g', '', {
				class: [axis, type, position, name].join(' '),
				transform: `translate(${position === 'right' ? width : 0},${position === 'bottom' ? height : 0})`,
				fill: 'none', 'font-size': 10, 'font-family': 'sans-serif',
				'text-anchor': horizontal ? 'middle' : sign < 0 ? 'end' : 'start',
			}, parent);
			const range = scale.range();
			_.create('svg:path', '', { class: 'domain', stroke: 'currentColor',
				d: horizontal ? `M${range[0]},${sign * 6}V0.5H${range[1]}V${sign * 6}` : `M${sign * 6},${range[0]}H0.5V${range[1]}H${sign * 6}` }, group);
			const values = scale.ticks(typeof ticks === 'function' ? ticks() : ticks);
			const step = values.length > 1 ? Math.abs(values[1] - values[0]) : 1;
			const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: Math.min(20, Math.max(0, -Math.floor(Math.log10(step)))) });
			for (const value of values) {
				const coordinate = scale(value) + 0.5;
				const tick = _.create('svg:g', '', { class: 'tick', opacity: 1, transform: horizontal ? `translate(${coordinate},0)` : `translate(0,${coordinate})` }, group);
				_.create('svg:line', '', { stroke: 'currentColor', [horizontal ? 'y2' : 'x2']: sign * size }, tick);
				const text = _.create('svg:text', '', { fill: 'currentColor', [horizontal ? 'y' : 'x']: sign * (Math.max(0, size) + tickPadding),
					dy: horizontal ? sign < 0 ? '0em' : '0.71em' : '0.32em' }, tick);
				text.textContent = typeof tickFormat === 'function' ? tickFormat(value) : tickFormat ?? format.format(value);
			}
			if (label) _.create('svg:text', '', {
				x: typeof labelX === 'function' ? labelX() : labelX,
				y: typeof labelY === 'function' ? labelY() : labelY,
			}, group).textContent = label;
			if (onAxisMount) onAxisMount(group);
		}
		chart._axis.querySelectorAll('.y.axis.right').forEach((axis, i) => {
			axis.setAttribute('transform', `translate(${this._width() + i * 40},0)`);
			if (i > 0) {
				axis.querySelector(':scope > path').setAttribute('opacity', 0.25);
				axis.querySelectorAll(':scope > .tick line').forEach(line => line.setAttribute('opacity', 0.75));
			}
		});
		const margins = {
			bottom: 60 + chart._axis.querySelectorAll('.x.axis.bottom').length * 2,
			left: 10 + chart._axis.querySelectorAll('.y.axis.left').length * 30,
			right: 40 + chart._axis.querySelectorAll('.y.axis.right').length * 30,
		};
		let updated = false;
		for (const side in margins) {
			if (chart._axis.querySelector(side === 'bottom' ? '.x.axis.bottom' : '.y.axis.' + side) && chart.options.margins[side] < margins[side]) {
				chart.options.margins[side] = margins[side];
				updated = true;
			}
		}
		if (updated) this.fire('margins_updated');

		const xAxesB = chart._axis.querySelectorAll('.x.axis.bottom').length;
		const items = Object.keys(chart._paths), n = items.length;
		let positions = Array.from({ length: Math.floor(n / 2) }, (_, i) => (i + 1) * 2 - (1 - Math.sign(n % 2)));
		positions = positions.slice().reverse().map(value => -value).concat(n % 2 ? [0] : [], positions);
		chart._legend.replaceChildren();
		for (const legend of Object.values(chart._props.legendItems)) {
			const { name, label, width, height, margins = {}, color, path, className = '' } = {
				width: this._width(), height: this._height(), margins: chart.options.margins, ...legend,
			};
			const group = _.create('svg:g', '', { class: 'legend-item legend-' + name.toLowerCase(), 'data-name': name, role: 'button', tabindex: 0 }, chart._legend);
			const toggle = () => group.ownerSVGElement.dispatchEvent(new CustomEvent('legend_clicked', {
				detail: { path, name, legend: group, enabled: !path.classList.contains('leaflet-hidden') },
			}));
			group.addEventListener('click', toggle);
			group.addEventListener('keydown', event => {
				if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
			});
			_.create('svg:rect', '', { x: width / 2 - 50, y: height + margins.bottom / 2, width: 50, height: 10,
				fill: color, stroke: '#000', 'stroke-opacity': 0.5, 'fill-opacity': 0.25, class: className }, group);
			const text = _.create('svg:text', '', { x: width / 2 + 5, y: height + margins.bottom / 2, 'font-size': 10, 'font-weight': 700, dy: '0.75em' }, group);
			text.textContent = L._(label || name);
		}
		if (n > 1 && chart.options.legend) {
			let index = 0;
			const group = _.create('svg:g', '', { class: 'legend-switcher', transform: `translate(${this._width()},${this._height() + 40})` }, chart._legend);
			const label = _.create('svg:text', '', { class: 'legend-switcher-label', 'text-anchor': 'end', x: -25, y: 5 }, group);
			const select = delta => {
				index = (index + delta + items.length) % items.length;
				label.textContent = L._(items[index][0].toUpperCase() + items[index].slice(1));
				for (const name of items) this._togglePath(name, name === items[index], true);
				this._updateArea();
			};
			label.addEventListener('click', () => select(1));
			for (const [x, y, angle, delta] of [[0, 3, 0, -1], [-13, 0, 180, 1]]) {
				const symbol = _.create('svg:path', '', { class: 'legend-switcher-symbol', d: 'M0,-6L5,3L-5,3Z',
					transform: `translate(${x},${y}) rotate(${angle})`, cursor: 'pointer', fill: '#000',
					role: 'button', tabindex: 0, 'aria-label': L._(delta > 0 ? 'Next profile' : 'Previous profile') }, group);
				symbol.addEventListener('click', () => select(delta));
				symbol.addEventListener('keydown', event => {
					if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(delta); }
				});
			}
			select(0);
		}
		items.forEach((name, i) => {
			const legend = chart._legend.querySelector(`[data-name="${name}"]`);
			if (legend) legend.setAttribute('transform', `translate(${positions[i] * 55},${xAxesB * 2})`);
			this._togglePath(name, chart.options[name] !== 'disabled', true);
		});
		chart._mask.querySelectorAll('.gap').forEach(node => node.remove());
		chart._maskGaps.forEach((index, i) => {
			if (i >= chart._maskGaps.length - 2) return;
			const x1 = chart._x(chart._data[index][chart.options.xAttr]);
			const x2 = chart._x(chart._data[chart._maskGaps[i + 1]][chart.options.xAttr]);
			_.create('svg:rect', '', { x: x1, y: 0, width: x2 - x1, height: this._height(), class: 'gap', 'fill-opacity': 0.8, fill: 'black' }, chart._mask);
		});
		this._updateArea();
		return chart;
  }
  _updateScale() {
		const chart = this._chart;
		for (const name in chart._domains) {
			const scale = chart._scales[name];
			scale.domain(chart._domains[name](chart._data)).range(chart._ranges[name](this._width(), this._height()));
			if (chart._props.axes[name].axis === 'x') {
				const { k, x } = chart._transform;
				scale.domain(scale.range().map(pixel => scale.invert((pixel - x) / k)));
			}
		}
		return { x: chart._x, y: chart._y };
  }
  _findIndexForXCoord(x) {
		const chart = this._chart;
		return Math.min(chart._data.length - 1, _.bisect(chart._data, chart._x.invert(x), chart.options.xAttr));
  }
  _findIndexForLatLng(latlng) {
		const chart = this._chart;
		let result = null, distance = Infinity;
		chart._data.forEach((item, index) => {
			const current = latlng.distanceTo(item.latlng);
			if (current < distance) { distance = current; result = index; }
		});
		return result;
  }
  _resetChartDrag() {
		const chart = this._chart;
		if (!chart._selection) return;
		chart._selection = null;
		for (const node of chart._chart.panes.brush.querySelectorAll('.selection, .handle')) node.setAttribute('display', 'none');
		this._hideDiagramIndicator();
		this.fire('reset_drag');
  }
  _resetZoom() {
		this._setZoom(1, 0);
  }
  _showDiagramIndicator(item, xCoordinate) {
		const chart = this._chart;
		chart._tooltip.removeAttribute('display');
		const group = chart._tooltip;
		const xCoord = xCoordinate, yCoord = chart._y(item[chart.options.yAttr]);
		group.replaceChildren();
		_.create('svg:line', '', { class: 'mouse-focus-line', x1: xCoord, x2: xCoord, y1: this._height(), y2: 0 }, group);
		const box = _.create('svg:g', '', { class: 'mouse-focus-label' }, group);
		const rect = _.create('svg:rect', '', { class: 'mouse-focus-label-rect', rx: 3, ry: 3 }, box);
		const text = _.create('svg:text', '', { class: 'mouse-focus-label-text', 'font-weight': 700 }, box);
		Object.values(chart._props.tooltipItems).sort((a, b) => a.order - b.order).forEach(label => {
			_.create('svg:tspan', '', { class: 'mouse-focus-label-' + label.name, dy: '1.5em' }, text).textContent =
				typeof label.value === 'function' ? label.value(item) : label.value;
		});
		if (text.firstChild) text.firstChild.setAttribute('dy', '1em');
		for (const span of text.children) span.setAttribute('x', 0);
		const bounds = text.getBBox();
		const x = xCoord ? xCoord + (xCoord < this._width() / 2 ? 10 : -bounds.width - 10) : 0;
		const y = yCoord ? Math.max(yCoord - bounds.height, /AppleWebKit/i.test(navigator.userAgent) ? 0 : -Infinity) : 0;
		for (const span of text.children) span.setAttribute('x', x);
		text.setAttribute('y', y);
		_.setAttributes(rect, { x: x + bounds.x - 5, y: y + bounds.y - 5, width: bounds.width + 10, height: bounds.height + 10 });
  }
  _togglePath(name, enabled = true, lazy = false) {
		const chart = this._chart;
		const path = chart._paths[name];
		const legend = chart._legend.querySelector(`[data-name="${name}"]`);
		path.classList.toggle('leaflet-hidden', !enabled);
		if (legend) {
			legend.querySelector('text').style.textDecorationLine = enabled ? '' : 'line-through';
			legend.querySelector('rect').style.fillOpacity = enabled ? '' : '0';
			legend.setAttribute('aria-pressed', enabled);
		}
		path.setAttribute('mask', `url(#${chart._mask.id})`);
		if (!lazy) this._updateArea();
  }
  _hideDiagramIndicator() {
		const chart = this._chart;
		chart._tooltip.setAttribute('display', 'none');
  }
  _xTicks() {
		const chart = this._chart;
		return chart.__xTicks || Math.round(this._width() / 75);
  }
  _yTicks() {
		const chart = this._chart;
		return chart.__yTicks || Math.round(this._height() / 30);
  }
  _initLayer() {
		this._layers
			.on('layeradd layerremove', ({layer, type}) => {
				let node  = layer.getElement && layer.getElement();
				_.toggleClass(node,  this.options.polyline.className + ' ' + this.options.theme, type == 'layeradd');
				_.toggleEvent(layer, L.version.startsWith('1.') ? "mousemove" : "pointermove", this._onMouseMoveLayer.bind(this), type == 'layeradd')
				_.toggleEvent(layer, L.version.startsWith('1.') ? "mouseout" : "pointerout", this._onMouseOut.bind(this), type == 'layeradd');
			});
	}
  /**
	 * Inspired by L.Control.Layers
	 */
  _initButton(container) {
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableScrollPropagation(container);

		this.options.collapsed ? this._collapse() : this._expand();

		if (this.options.autohide) {
			_.on(container, 'mouseover', this._expand,   this);
			_.on(container, 'mouseout',  this._collapse, this);
			this._map.on('click', this._collapse, this);
		}

		if (this.options.closeBtn) {
			let link = this._button = _.create('a', "elevation-toggle-icon", { href: '#', title: L._('Elevation'), }, container);
			_.on(link, 'click', L.DomEvent.stop);
			_.on(link, 'click', this._toggle, this);
			_.on(link, 'focus', this._toggle, this);
			fetch(_.resolveURL(this.__btnIcon, this.options.srcFolder)).then(r => r.ok && r.text().then(img => link.innerHTML = img));
		}
	}
  /**
	 * Retrieve data from a remote url (HTTP).
	 */
  _loadFile(url) {
		fetch(url)
			.then((response) => response.text())
			.then((data)     => {
				this._downloadURL = url; // TODO: handle multiple urls?
				this._parseFromString(data)
					.then( geojson => geojson && this._loadLayer(geojson));
			}).catch((err) => console.warn(err));
	}
  /**
	 * Dynamically import only required javascript modules (code splitting)
	 */
  _loadModules(handlers) {
		// First map known classnames (eg. "Altitude" --> L.Control.Elevation.Altitude)
		handlers = handlers.map((h) => typeof h === 'string' && typeof Elevation[h] !== "undefined" ? Elevation[h] : h);
		// Then load optional classes and custom imports (eg. "Cadence" --> import('../src/handlers/cadence.js'))
		let modules = handlers.map(file => (typeof file === 'string' && this.import(this.__modulesFolder + file.toLowerCase() + '.js')) || (file instanceof Promise && file) || Promise.resolve());
		return Promise.all(modules).then((m) => {
			_.each(m, (exported, i) => {
				let fn = exported && Object.keys(exported)[0];
				if (fn) {
					handlers[i] = Elevation[fn] = (Elevation[fn] ?? exported[fn]);
				}
			});
			_.each(handlers, h => ["function", "object"].includes(typeof h) && this._registerHandler(h));
		});
	}
  /**
	 * Simple GeoJSON data loader (L.GeoJSON).
	 */
  _loadLayer(geojson) {
		let { polyline, theme, waypoints, wptIcons, wptLabels, distanceMarkers } = this.options;
		let style = Object.assign({}, polyline);
		let dataAdded = [];

		if (theme) {
			style.className += ' ' + theme;
		}

		if (geojson.name) {
			this.track_info.name = geojson.name;
		}

		let layer = new L.GeoJSON(geojson, {
			distanceMarkers: distanceMarkers,
			style: style,
			pointToLayer: (feature, latlng) => {
				if (waypoints) {
					let { desc, name, sym } = feature.properties;
					desc = desc || '';
					name = name || '';
					// Handle chart waypoints (dots)
					if ([true, 'dots'].includes(waypoints)) {
						this._registerCheckPoint({
							latlng: latlng,
							label : ([true, 'dots'].includes(wptLabels) ? name : '')
						});
					}
					// Handle map waypoints (markers)
					if ([true, 'markers'].includes(waypoints) && wptIcons != false) {
						return this._registerMarker({
							latlng : latlng,
							sym    : (sym ?? name).replace(/["']/g, '').replace(/ /g, '-').toLowerCase(),
							content: [true, 'markers'].includes(wptLabels) && (name || desc) && decodeURI("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : ''))
						});
					}
				}
			},
			onEachFeature: (feature, layer) => feature.geometry && feature.geometry.type != 'Point' && dataAdded.push(this.addData(feature, layer)),
		});

		Promise.all(dataAdded).then(() => {
			this._initMapIntegrations(layer);
			const event_data = { data: geojson, layer: layer, name: this.track_info.name, track_info: this.track_info };
			if (this._modulesLoaded) {
				this._fireEvt("eledata_loaded", event_data);
			} else {
				this.once('modules_loaded', () => this._fireEvt("eledata_loaded", event_data));
			}
		});

		return layer;
	}
  _onDragEnd({ dragstart, dragend}) {
		this._hideMarker();
		this.fitBounds(new L.LatLngBounds([dragstart.latlng, dragend.latlng]));

		this.fire("elechart_dragged");
	}
  _onKeyDown({key}) {
		if (!this.options.detached && key === "Escape"){
			this._collapse()
		};
	}
  /**
	 * Trigger mouseenter event.
	 */
  _onMouseEnter() {
		this.fire('elechart_enter');
	}
  /*
	 * Handles the moueseover the chart and displays distance and altitude level.
	 */
  _onMouseMove({xCoord}) {
		if (this._chartEnabled && this._data.length) {
			let item = this._findItemForX(xCoord);
			if (item) {
				if (this._chartEnabled) this._showDiagramIndicator(item, xCoord);

				this._updateMarker(item);
				this._setMapView(item);

				if (this._map) {
					_.addClass(this._map.getContainer(), 'elechart-hover');
				}

				this.fire("elechart_change", { data: item, xCoord: xCoord });
				this.fire("elechart_hover",  { data: item, xCoord: xCoord });
			}
		}
	}
  /*
	 * Handles mouseover events of the data layers on the map.
	 */
  _onMouseMoveLayer({latlng}) {
		if (this._data.length) {
			let item = this._findItemForLatLng(latlng);
			if (item) {
				let xCoord = item.xDiagCoord;

				if (this._chartEnabled) this._showDiagramIndicator(item, xCoord);

				this._updateMarker(item);

				this.fire("elechart_change", { data: item, xCoord: xCoord });
			}
		}
	}
  /*
	 * Handles the moueseout over the chart.
	 */
  _onMouseOut() {
		if (!this.options.detached) {
			this._hideMarker();
			this._hideDiagramIndicator();
		}

		if (this._map) {
			_.removeClass(this._map.getContainer(), 'elechart-hover');
		}

		this.fire("elechart_leave");
	}
  /**
	 * Handles the drag event over the ruler filter.
	 */
  _onRulerFilter({coords}) {
		this._updateMapSegments(coords);
	}
  /**
	 * Toggle chart data on legend click
	 */
  _onToggleChart({ name, enabled }) {

		this._chartEnabled = this._hasActiveLayers();

		// toggle layer visibility on empty chart
		this._layers.eachLayer(layer => {
			_.toggleClass(layer.getElement && layer.getElement(), this.options.polyline.className + ' ' + this.options.theme, this._chartEnabled);
			if (layer._renderer instanceof L.Canvas) layer.redraw();
		});

		// toggle option value (eg. altitude = { 'disabled' || 'enabled' })
		this.options[name] = !enabled && this.options[name] == 'disabled' ? 'enabled' : 'disabled';

		// remove marker on empty chart
		if (!this._chartEnabled) {
			this._hideDiagramIndicator();
			this._marker.remove();
		}
	}
  /**
	 * Simple GeoJSON Parser
	 */
  _parseFromGeoJSONString(data) {
		try {
			return JSON.parse(data);
		} catch (e) { }
	}
  /**
	 * Attempt to parse raw response data (GeoJSON or XML > GeoJSON)
	 */
  _parseFromString(data) {
		return new Promise(resolve =>
			this.import(this.__TOGEOJSON).then(() => {
				let geojson;
				try {
					geojson = this._parseFromXMLString(data.trim());
				} catch (e) {
					geojson = this._parseFromGeoJSONString(data.toString());
				}
				if (geojson) {
					geojson.name = geojson.name || (this._downloadURL || '').split('/').pop().split('#')[0].split('?')[0];
				}
				resolve(geojson);
			})
		);
	}
  /**
	 * Simple XML Parser (GPX, KML, TCX)
	 */
  _parseFromXMLString(data) {
		if (data.indexOf("<") != 0) {
			throw 'Invalid XML';
		}
		let xml  = (new DOMParser()).parseFromString(data, "text/xml");
		let type = xml.documentElement.tagName.toLowerCase(); // "kml" or "gpx"
		let name = xml.getElementsByTagName('name');
		if (xml.getElementsByTagName('parsererror').length) {
			throw 'Invalid XML';
		}
		if (!(type in toGeoJSON)) {
			type = xml.documentElement.tagName == "TrainingCenterDatabase" ? 'tcx' : 'gpx';
		}
		let geojson  = toGeoJSON[type](xml);
		geojson.name = name.length > 0 ? (Array.from(name).find(tag => tag.parentElement.tagName == "trk") ?? name[0]).textContent : '';
		return geojson;
	}
  /**
	 * Add chart profile to diagram
	 */
  _registerAreaPath(props) {
		this.on("elechart_init", () => this._registerChartAreaPath(props));
	}
  /**
	 * Add chart grid to diagram
	 */
  _registerAxisGrid(props) {
		this.on("elechart_axis", () => this._registerChartAxisGrid(props));
	}
  /**
	 * Add chart axis to diagram
	 */
  _registerAxisScale(props) {
		this.on("elechart_axis", () => this._registerChartAxisScale(props));
	}
  /**
	 * Add a point of interest over the diagram
	 */
  _registerCheckPoint(props) {
		const cb = () => this._registerChartCheckPoint(props);
		this
			.on("elechart_updated", cb)
			.once("eledata_clear", () => this.off("elechart_updated", cb));
	}
  /**
	 * Base handler for iterative track statistics (dist, time, z, slope, speed, acceleration, ...)
	 */
  _registerDataAttribute(props) {

		// parse of "coordinateProperties" for later usage
		if (props.coordPropsToMeta) {
			this.on("elepoint_init", (e) => props.coordPropsToMeta.call(this, e));
		}

		// prevent excessive variabile instanstations
		let i, curr, prev, attr = props.attr || props.name;

		// save here a reference to last used point
		let lastValid = {};

		// iteration
		this.on("elepoint_added", ({index, point}) => {
			i = index;

			prev = curr ?? this._data[i]; // same as: this._data[i > 0 ? i - 1 : i]
			curr = this._data[i];

			// retrieve point value
			curr[attr] = props.pointToAttr.call(this, point, i);

			// check and fix missing data on last added point
			if (i > 0 && isNaN(prev[attr])) {
				if (!isNaN(lastValid[attr]) && !isNaN(curr[attr])) {
					prev[attr]   = (lastValid[attr] + curr[attr]) / 2;
				} else if (!isNaN(lastValid[attr])) {
					prev[attr]   = lastValid[attr];
				} else if (!isNaN(curr[attr])) {
					prev[attr]   = curr[attr];
				}
				// update "yAttr" and "xAttr"
				if (props.meta) {
					prev[props.meta] = prev[attr];
				}
			}

			// skip to next iteration for invalid or missing data (eg. i == 0)
			if (isNaN(curr[attr])) {
				return;
			}

			// update reference to last used point
			lastValid[attr] = curr[attr];

			// Limit "crazy" delta values.
			if (props.deltaMax) {
				curr[attr] =_.wrapDelta(curr[attr], prev[attr], props.deltaMax);
			}

			// Range of acceptable values.
			if (props.clampRange) {
				curr[attr] = _.clamp(curr[attr], props.clampRange);
			}

			// Limit floating point precision.
			if (!isNaN(props.decimals)) {
				curr[attr] = _.round(curr[attr], props.decimals);
			}

			// update "track_info" stats (min, max, avg, ...)
			if (props.stats) {
				for (const key in props.stats) {
					let sname = (props.statsName || attr) + (key != '' ? '_' : '');
					this.track_info[sname + key] = props.stats[key].call(this, curr[attr], this.track_info[sname + key], this._data.length);
				}
			}

			// update here some mixins (eg. complex "track_info" stuff)
			if (props.onPointAdded) props.onPointAdded.call(this, curr[attr], i, point);
		});
	}
  /**
	 * Parse a module definition and attach related function listeners
	 */
  _registerHandler(props) {

		// eg. L.Control.Altitude
		if (typeof props === "function") {
			return this._registerHandler(props.call(this));
		}

		let {
			name,
			attr,
			required,
			deltaMax,
			clampRange,
			decimals,
			meta,
			unit,
			coordinateProperties,
			coordPropsToMeta,
			pointToAttr,
			onPointAdded,
			stats,
			statsName,
			grid,
			scale,
			path,
			tooltip,
			summary
		} = props;

		// eg. "altitude" == true
		if (this.options[name] || required) {

			this._registerDataAttribute({
				name,
				attr,
				meta,
				deltaMax,
				clampRange,
				decimals,
				coordPropsToMeta: _.coordPropsToMeta(coordinateProperties, meta || name, coordPropsToMeta),
				pointToAttr,
				onPointAdded,
				stats,
				statsName,
			});

			if (grid) {
				this._registerAxisGrid(Object.assign({ name }, grid));
			}

			if (this.options[name] !== "summary") {
				if (scale) this._registerAxisScale(Object.assign({ name, label: unit }, scale));
				if (path)  this._registerAreaPath(Object.assign({ name }, path));
			}

			if (tooltip || props.tooltips) {
				_.each([tooltip, ...(props.tooltips || [])], t => t && this._registerTooltip(Object.assign({ name }, t)));
			}

			if (summary) {
				_.each(summary, (s, k) => summary[k] = Object.assign({ unit }, s));
				this._registerSummary(summary);
			}
		}
	}
  _registerMarker({latlng, sym, content}) {
		let { wptIcons } = this.options;
		// generate and cache appropriate icon symbol
		if (!wptIcons.hasOwnProperty(sym)) {
			wptIcons[sym] = new L.DivIcon(Object.assign({}, wptIcons[""].options, { html: '<i class="elevation-waypoint-icon ' + sym + '"></i>' } ));
		}
		let marker = new L.Marker(latlng, { icon: wptIcons[sym] });
		if (content) {
			marker.bindPopup(content, { className: 'elevation-popup', keepInView: true }).openPopup();
			marker.bindTooltip(content, { className: 'elevation-tooltip', direction: 'auto', sticky: true, opacity: 1 }).openTooltip();
		}
		return this._addMarker(marker)
	}
  /**
	 * Add chart or marker tooltip info
	 */
  _registerTooltip(props) {
		props.chart  && this.on("elechart_init",   () => this._registerChartTooltip(Object.assign({}, props, { value: props.chart })));
		props.marker && this.on("elechart_marker", () => this._marker._registerTooltip(Object.assign({}, props, { value: props.marker })));
	}
  /**
	 * Add summary info to diagram
	 */
  _registerSummary(props) {
		this.on('elechart_summary',  () => this._summary._registerSummary(props));
	}
  /*
	 * Removes the drag rectangle and zoms back to the total extent of the data.
	 */
  _resetDrag() {
		this._resetChartDrag();
		this._hideMarker();
	}
  /**
	 * Resets drag, marker and bounds.
	 */
  _resetView() {
		if (this._map && this._map._isFullscreen) return;
		this._resetDrag();
		this._hideMarker();
		if (this.options.autofitBounds) {
			this.fitBounds();
		}
	}
  /**
	 * Hacky way for handling chart resize. Deletes it and redraw chart.
	 */
  _resizeChart() {
		if (this._container && _.style(this._container, "display") != "none") {
			let opts = this.options;
			let newWidth = opts.detached ? (this.eleDiv || this._container).offsetWidth : _.clamp(opts._maxWidth, [0, this._map.getContainer().clientWidth - 30]);
			if (newWidth) {
				opts.width = newWidth;
				if (this._chart && this._chart._chart) {
					this._chart._chart._resize(opts);
					this._updateChart();
				}
			}
			this._updateMapSegments();
		}
	}
  /**
	 * Collapse or Expand chart control.
	 */
  _toggle() {
		_.hasClass(this._container, "elevation-expanded") ? this._collapse() : this._expand();
	}
  /**
	 * Update map center and zoom (followMarker: true)
	 */
  _setMapView(item) {
		if (this._map && this.options.followMarker) {
			let zoom = this._map.getZoom();
			let z    = this.options.zFollow;
			if (typeof z === "number") {
				this._map.setView(item.latlng, (zoom < z ? z : zoom), { animate: true, duration: 0.25 });
			} else if (!this._map.getBounds().contains(item.latlng)) {
				this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
			}
		}
	}
  /**
	 * Calculates [x, y] domain and then update chart.
	 */
  _updateChart() {
		if (this._chart && this._container) {
			this.fire("elechart_axis");

			this._renderChart({ data: this._data, options: this.options });

			this._x     = this._chart._x;
			this._y     = this._chart._y;

			this.fire('elechart_updated');
		}
	}
  /*
	 * Update the position/height indicator marker drawn onto the map
	 */
  _updateMarker(item) {
		if (this._marker) {
			this._marker.update({
				map         : this._map,
				item        : item,
				yCoordMin   : this._yCoordMin,
				yCoordMax   : this._yCoordMax || 0,
				options     : this.options
			});
		}
	}
  /**
	 * Fix marker rotation on rotated maps
	 */
  _rotateMarker() {
		if (this._marker) {
			this._marker.update();
		}
	}
  /**
	 * Highlight track segments on the map.
	 */
  _updateMapSegments(coords) {
		this._markedSegments.setLatLngs(coords || []);
		if (coords && this._map && !this._map.hasLayer(this._markedSegments)) {
			this._markedSegments.addTo(this._map);
		}
	}
  /**
	 * Update chart summary.
	 */
  _updateSummary() {
		if (this._chart && this._chart._summary) this._updateChartSummary();
	}
  /**
	 * Calculates chart width.
	 */
  _width() {
		const { width, margins } = this.options;
		return width - margins.left - margins.right;
	}
  /**
	 * Calculates chart height.
	 */
  _height() {
		const { height, margins } = this.options;
		return height - margins.top - margins.bottom;
	}
  static {
    this.mergeOptions(Options);
    this.prototype.__mileFactor = 0.621371;
    this.prototype.__footFactor = 3.28084;
    this.prototype.__TOGEOJSON = 'https://unpkg.com/@tmcw/togeojson@7.1.3/dist/togeojson.umd.js';
    this.prototype.__LHOTLINE = '../libs/leaflet-hotline.min.js';
    this.prototype.__LDISTANCEM = '../libs/leaflet-distance-marker.min.js';
    this.prototype.__LEDGESCALE = '../libs/leaflet-edgescale.min.js';
    this.prototype.__modulesFolder = '../src/handlers/';
    this.prototype.__btnIcon = '../images/elevation.svg';
  }
};

// backcomp for leaflet v1
if (!('on' in Elevation.prototype)) {
	for (const name of Object.getOwnPropertyNames(L.Evented.prototype)) {
		if (!['constructor', 'callInitHooks', '_initHooks', 'options'].includes(name)) {
			Object.defineProperty(Elevation.prototype, name, Object.getOwnPropertyDescriptor(L.Evented.prototype, name));
		}
	}
}

Elevation.Utils = _;

// backcomps for leaflet v1
L.control = L.control || {};
L.control.elevation = (options) => new Elevation(options);
