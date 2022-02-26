import 'leaflet-i18n';
import * as _      from './utils';
import * as D3     from './components';
import { Chart }   from './chart';
import { Marker }  from './marker';
import { Summary } from './summary';
import { Options } from './options';

export const Elevation = L.Control.Elevation = L.Control.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	options: Options,
	__mileFactor: 0.621371,
	__footFactor: 3.28084,
	__D3:          'https://unpkg.com/d3@6.5.0/dist/d3.min.js',
	__TOGEOJSON:   'https://unpkg.com/@tmcw/togeojson@4.3.0/dist/togeojson.umd.js',
	__LGEOMUTIL:   'https://unpkg.com/leaflet-geometryutil@0.9.3/src/leaflet.geometryutil.js',
	__LALMOSTOVER: 'https://unpkg.com/leaflet-almostover@1.0.1/src/leaflet.almostover.js',
	__LDISTANCEM:  'https://unpkg.com/@raruto/leaflet-elevation@1.8.5/libs/leaflet-distance-marker.min.js',

	/*
	 * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
	 */
	addData: function(d, layer) {
		this.lazyLoad(this.__D3)
			.then(() => {
				if (typeof layer === "undefined" && d.on) {
					layer = d;
				}
				this._addData(d);
				this._addLayer(layer);
				this._fireEvt("eledata_added", { data: d, layer: layer, track_info: this.track_info });
			});
	},

	/**
	 * Adds the control to the given map.
	 */
	addTo: function(map) {
		if (this.options.detached) {
			let eleDiv = this._initElevationDiv();
			if (!eleDiv.isConnected) _.insert(map.getContainer(), eleDiv, 'afterend');
			_.append(eleDiv, this.onAdd(map));
		} else {
			L.Control.prototype.addTo.call(this, map);
		}
		return this;
	},

	/*
	 * Reset data and display
	 */
	clear: function() {
		if (this._marker) this._marker.remove();
		if (this._chart)  this._clearChart();
		if (this._layers) this._clearLayers();
		if (this._markers) this._clearMarkers();

		this._data      = [];
		this.track_info = {};

		this._fireEvt("eledata_clear");

		this._updateChart();
	},

	_clearChart: function() {
		if (this._events && this._events.elechart_updated) {
			this._events.elechart_updated.forEach(e => this.off('elechart_updated', e.fn, e.ctx));
		}
		if (this._chart && this._chart._container) {
			this._chart._container.selectAll('g.point .point').remove();
			this._chart.clear();
		}
	},

	_clearLayers: function() {
		if (this._layers && this._layers.eachLayer) {
			this._layers.eachLayer(l => l.remove())
			this._layers.clearLayers();
		}
	},

	_clearMarkers: function() {
		if (this._markers && this._markers.eachLayer) {
			this._markers.eachLayer(l => l.remove())
			this._markers.clearLayers();
		}
	},

	/**
	 * Disable chart brushing.
	 */
	disableBrush: function() {
		this._chart._brushEnabled = false;
		this._resetDrag();
	},

	/**
	 * Enable chart brushing.
	 */
	enableBrush: function() {
		this._chart._brushEnabled = true;
	},

	/**
	 * Disable chart zooming.
	 */
	disableZoom: function() {
		this._chart._zoomEnabled = false;
		this._chart._resetZoom();
	},

	/**
	 * Enable chart zooming.
	 */
	enableZoom: function() {
		this._chart._zoomEnabled = true;
	},

	/**
	 * Sets a map view that contains the given geographical bounds.
	 */
	fitBounds: function(bounds) {
		bounds = bounds || this.getBounds();
		if (this._map && bounds.isValid()) this._map.fitBounds(bounds);
	},

	getBounds: function(data) {
		data = data || this._data;
		return L.latLngBounds(data.map((d) => d.latlng));
	},

	/**
	 * Get default zoom level when "followMarker" is true.
	 */
	getZFollow: function() {
		return this.options.zFollow;
	},

	/**
	 * Hide current elevation chart profile.
	 */
	hide: function() {
		_.style(this._container, "display", "none");
	},

	/**
	 * Initialize chart control "options" and "container".
	 */
	initialize: function(options) {
		this._data           = [];
		this._layers         = L.featureGroup();
		this._markers        = L.featureGroup();
		this._markedSegments = L.polyline([]);
		this._chartEnabled   = true,
		this.track_info      = {};

		L.setOptions(this, options);

		if (this.options.followMarker)             this._setMapView = L.Util.throttle(this._setMapView, 300, this);
		if (this.options.legend)                   this.options.margins.bottom += 30;
		if (this.options.theme)                    this.options.polylineSegments.className += ' ' + this.options.theme;
		if (this.options.wptIcons === true)        this.options.wptIcons = Options.wptIcons;
		if (this.options.distanceMarkers === true) this.options.distanceMarkers = { lazy: true };

		this._markedSegments.setStyle(this.options.polylineSegments);

		// Leaflet canvas renderer colors
		L.extend(D3.Colors, this.options.colors || {});

		// Various stuff
		this._fixCanvasPaths();
		this._fixTooltipSize();
	},

	/**
	 * Javascript scripts downloader (lazy loader)
	 */
	lazyLoad: function(src, condition = false, loader = '') {
		if (!this.options.lazyLoadJS) {
			return Promise.resolve();
		}
		switch(src) {
			case this.__D3:
				loader    = '_d3LazyLoader';
				condition = typeof d3 !== 'object';
			break;
			case this.__TOGEOJSON:
				loader    = '_togeojsonLazyLoader';
				condition = typeof toGeoJSON !== 'object';
			break;
			case this.__LGEOMUTIL:
				loader    = '_geomutilLazyLoader';
				condition = typeof L.GeometryUtil !== 'object';
			break;
			case this.__LALMOSTOVER:
				loader    = '_almostoverLazyLoader';
				condition = typeof L.Handler.AlmostOver  !== 'function';
			break;
			case this.__LDISTANCEM:
				loader    = '_distanceMarkersLazyLoader';
				condition = typeof L.DistanceMarkers  !== 'function';
			break;
		}
		return L.Control.Elevation[loader] = _.lazyLoader(src, condition, L.Control.Elevation[loader]);
	},

	/**
	 * Load elevation data (GPX, GeoJSON or KML).
	 */
	load: function(data) {
		this._parseFromString(data).then( geojson => geojson ? this._loadLayer(geojson) : this._loadFile(data));
	},

	/**
	 * Create container DOM element and related event listeners.
	 * Called on control.addTo(map).
	 */
	onAdd: function(map) {
		this._map = map;

		let container = this._container = _.create("div", "elevation-control elevation " + this.options.theme + " " + (this.options.detached ? '' : 'leaflet-control'));
		
		this.lazyLoad(this.__D3)
			.then(() => {
				this._initButton(container);
				this._initChart(container);
				this._initSummary(container);
				this._initMarker(map);
				this._initLayer(map);

				map
					.on('zoom viewreset zoomanim',       this._hideMarker,    this)
					.on('resize',                        this._resetView,     this)
					.on('resize',                        this._resizeChart,   this)
					.on('rotate',                        this._rotateMarker,  this)
					.on('mousedown',                     this._resetDrag,     this);

				_.on(map.getContainer(), 'mousewheel', this._resetDrag,       this);
				_.on(map.getContainer(), 'touchstart', this._resetDrag,       this);
				_.on(document,           'keydown',    this._keydownHandler,  this);

				this
					.on('eledata_added eledata_loaded',  this._updateChart,   this)
					.on('eledata_added eledata_loaded',  this._updateSummary, this);

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

		map
			.off('zoom viewreset zoomanim',       this._hideMarker,    this)
			.off('resize',                        this._resetView,     this)
			.off('resize',                        this._resizeChart,   this)
			.off('mousedown',                     this._resetDrag,     this);

		_.off(map.getContainer(), 'mousewheel', this._resetDrag,       this);
		_.off(map.getContainer(), 'touchstart', this._resetDrag,       this);
		_.off(document,           'keydown',    this._keydownHandler,  this);

		this
			.off('eledata_added eledata_loaded',  this._updateChart,   this)
			.off('eledata_added eledata_loaded',  this._updateSummary, this);
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
		this.options.zFollow = zoom;
	},

	/**
	 * Hide current elevation chart profile.
	 */
	show: function() {
		_.style(this._container, "display", "block");
	},

	/*
	 * Parsing data either from GPX or GeoJSON and update the diagram data
	 */
	_addData: function(d) {
		if (!d) {
			return;
		}

		let geom = d.geometry;
		if (geom) {
			switch (geom.type) {
				case 'LineString':
					this._addGeoJSONData(geom.coordinates);
					break;

				case 'MultiLineString':
					_.each(geom.coordinates, coords => this._addGeoJSONData(coords));
					break;

				default:
					console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
			}
		}

		if (d.type === "FeatureCollection") {
			_.each(d.features, feature => this._addData(feature));
		}

		if (d._latlngs) {
			this._addGPXData(d._latlngs);
		}
	},

	/*
	 * Parsing of GeoJSON data lines and their elevation in z-coordinate
	 */
	_addGeoJSONData: function(coords) {
		_.each(coords, point => {
			this._addPoint(point[1], point[0], point[2]);
			this._fireEvt("elepoint_added", { point: point, index: this._data.length - 1 });
		});
		this._fireEvt("eletrack_added", { coords: coords, index: this._data.length - 1 });
	},

	/*
	 * Parsing function for GPX data and their elevation in z-coordinate
	 */
	_addGPXData: function(coords) {
		_.each(coords, point => {
			this._addPoint(point.lat, point.lng, point.alt ?? point.meta.ele);
			this._fireEvt("elepoint_added", { point: point, index: this._data.length - 1 });
		});
		this._fireEvt("eletrack_added", { coords: coords, index: this._data.length - 1 });
	},

	/*
	 * Parse and push a single (x, y, z) point to current elevation profile.
	 */
	_addPoint: function(x, y, z) {
		if (this.options.reverseCoords) {
			[x, y] = [y, x];
		}

		this._data.push({
			x: x,
			y: y,
			z: z,
			latlng: L.latLng(x, y, z)
		});

		this._fireEvt("eledata_updated", { index: this._data.length - 1 });
	},

	_addLayer: function(layer) {
		if (layer) this._layers.addLayer(layer)
		// Postpone adding the distance markers (lazy: true)
		if (layer && this.options.distanceMarkers && this.options.distanceMarkers.lazy) {
			layer.on('add remove', (e) => L.DistanceMarkers && e.target instanceof L.Polyline && e.target[e.type + 'DistanceMarkers']());
		}
	},

	_addMarker: function(marker) {
		if (marker) this._markers.addLayer(marker)
	},

	_bindPopup: function(marker) {
		let popup = marker._popup;
		if (popup) {
			popup.options.className = 'elevation-popup';
			if (popup._content) {
				popup._content = decodeURI(popup._content);
				popup.bindTooltip(popup._content, { direction: 'auto', sticky: true, opacity: 1, className: 'elevation-tooltip' }).openTooltip();
			}
		}
	},

	_initAlmostOverHandler: function(map, layer) {
		if(!map || !this.options.almostOver) return;
		this.lazyLoad(this.__LGEOMUTIL)
			.then(() => this.lazyLoad(this.__LALMOSTOVER))
			.then(() => {
					map.addHandler('almostOver', L.Handler.AlmostOver)
					if (L.GeometryUtil && map.almostOver && map.almostOver.enabled()) {
						map.almostOver.addLayer(layer);
						map
							.on('almost:move', (e) => this._mousemoveLayerHandler(e))
							.on('almost:out',  (e) => this._mouseoutHandler(e));
					}
			});
	},

	_initDistanceMarkers: function(map, layer) {
		if (!map) return;
		if (this.options.distanceMarkers) {
			this.lazyLoad(this.__LGEOMUTIL)
				.then(() => this.lazyLoad(this.__LDISTANCEM))
				.then(() => this.options.polyline && layer.addTo(map));
		} else if (this.options.polyline) {
			layer.addTo(map);
		}
	},

	/**
	 * Adds the control to the given "detached" div.
	 */
	_initElevationDiv: function() {
		let eleDiv = _.select(this.options.elevationDiv);
		if (!eleDiv) {
			this.options.elevationDiv = '#elevation-div_' + _.randomId();
			eleDiv                    = _.create('div', 'leaflet-control elevation elevation-div', { id: this.options.elevationDiv.substr(1) });
		}
		if (this.options.detached) {
			_.replaceClass(eleDiv, 'leaflet-control', 'elevation-detached');
		}
		return this.eleDiv = eleDiv;
	},

	/*
	 * Collapse current chart control.
	 */
	_collapse: function() {
		_.replaceClass(this._container, 'elevation-expanded', 'elevation-collapsed');
	},

	/*
	 * Expand current chart control.
	 */
	_expand: function() {
		_.replaceClass(this._container, 'elevation-collapsed', 'elevation-expanded');
	},

	/**
	 * Add some basic colors to leaflet canvas renderer (preferCanvas: true).
	 */
	_fixCanvasPaths: function() {
		let oldProto = L.Canvas.prototype._fillStroke;
		let control  = this;
		L.Canvas.include({
			_fillStroke: function(ctx, layer) {
				if (control._layers.hasLayer(layer)) {

					let theme      = control.options.theme.replace('-theme', '');
					let color      = D3.Colors[theme] || {};
					let options    = layer.options;

					options.color  = color.line || color.area || theme;
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
	},

	/**
	 * Partial fix for initial tooltip size
	 * 
	 * @link https://github.com/Raruto/leaflet-elevation/issues/81#issuecomment-713477050
	 */
	_fixTooltipSize: function() {
		this.on('elechart_init', () =>
			this.once('elechart_change elechart_hover', e => {
				if (this._chartEnabled) {
					this._chart._showDiagramIndicator(e.data, e.xCoord);
					this._chart._showDiagramIndicator(e.data, e.xCoord);
				}
				this._updateMarker(e.data);
			})
		);
	},

	/*
	 * Finds a data entry for the given LatLng
	 */
	_findItemForLatLng: function(latlng) {
		return this._data[this._chart._findIndexForLatLng(latlng)];
	},

	/*
	 * Finds a data entry for the given xDiagCoord
	 */
	_findItemForX: function(x) {
		return this._data[this._chart._findIndexForXCoord(x)];
	},

	/**
	 * Fires an event of the specified type.
	 */
	_fireEvt: function(type, data, propagate) {
		if (this.fire) this.fire(type, data, propagate);
		if (this._map) this._map.fire(type, data, propagate);
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		if (this._chart) return this._chart._height();
		let opts = this.options;
		return opts.height - opts.margins.top - opts.margins.bottom;
	},

	/*
	 * Hides the position/height indicator marker drawn onto the map
	 */
	_hideMarker: function() {
		if (this.options.autohideMarker) {
			this._marker.remove();
		}
	},

	/**
	 * Generate "svg" chart DOM element.
	 */
	_initChart: function(container) {
		let opts    = this.options;

		opts.xTicks = this._xTicks();
		opts.yTicks = this._yTicks();

		if (opts.detached) {
			let { offsetWidth, offsetHeight}             = this.eleDiv;
			if (offsetWidth > 0)             opts.width  = offsetWidth;
			if (offsetHeight > 20)           opts.height = offsetHeight - 20; // 20 = horizontal scrollbar size.
		} else {
			let { clientWidth }                          = this._map.getContainer();
			opts._maxWidth                               = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;
			this._container.style.maxWidth               = opts._maxWidth + 'px';
			if (opts._maxWidth > clientWidth) opts.width = clientWidth - 30;
		}

		let chart = this._chart = new Chart(opts, this);

		this._x     = this._chart._x;
		this._y     = this._chart._y;

		d3
			.select(container)
			.call(chart.render())

		chart
			.on('reset_drag',     this._hideMarker,                     this)
			.on('mouse_enter',    this._fireEvt.bind('elechart_enter'), this)
			.on('dragged',        this._dragendHandler,                 this)
			.on('mouse_move',     this._mousemoveHandler,               this)
			.on('mouse_out',      this._mouseoutHandler,                this)
			.on('ruler_filter',   this._rulerFilterHandler,             this)
			.on('zoom',           this._updateChart,                    this)
			.on('elepath_toggle', this._toggleChartHandler,             this)
			.on('margins_updated',this._resizeChart,                    this);


		this._fireEvt("elechart_axis");
		if (this.options.legend) this._fireEvt("elechart_legend");

		this._fireEvt("elechart_init");
	},

	_initLayer: function() {
		this._layers
			.on('layeradd layerremove', (e) => {
				let layer = e.layer
				let node  = layer.getElement && layer.getElement();
				_.toggleClass(node,  this.options.polyline.className + ' ' + this.options.theme, e.type == 'layeradd');
				_.toggleEvent(layer, "mousemove", this._mousemoveLayerHandler.bind(this),        e.type == 'layeradd')
				_.toggleEvent(layer, "mouseout",  this._mouseoutHandler.bind(this),              e.type == 'layeradd');
			});
	},

	_initMarker: function(map) {
		let pane                     = map.getPane('elevationPane');
		if (!pane) {
			pane = this._pane        = map.createPane('elevationPane', map.getPane('norotatePane') || map.getPane('mapPane'));
			pane.style.zIndex        = 625; // This pane is above markers but below popups.
			pane.style.pointerEvents = 'none';
		}

		if (this._renderer) this._renderer.remove()
		this._renderer               = L.svg({ pane: "elevationPane" }).addTo(this._map); // default leaflet svg renderer
		this._marker                 = new Marker(this.options);

		this._fireEvt("elechart_marker");
	},

	/**
	 * Inspired by L.Control.Layers
	 */
	_initButton: function(container) {

		if (L.Browser.mobile || !this.options.detached) {
			L.DomEvent
				.disableClickPropagation(container)
				.disableScrollPropagation(container);
		}

		if (!this.options.detached) {
			let link = this._button = _.create('a', "elevation-toggle elevation-toggle-icon" + (this.options.autohide ? "" : " close-button"), { href: '#', title: L._('Elevation') }, container);

			if (this.options.collapsed) {
				this._collapse();
				if (this.options.autohide) {
					_.on(container, 'mouseover', this._expand,   this);
					_.on(container, 'mouseout',  this._collapse, this);
				} else {
					_.on(link, 'click', L.DomEvent.stop);
					_.on(link, 'click', this._toggle, this);
				}

				_.on(link, 'focus', this._toggle, this);

				this._map.on('click', this._collapse, this);
			}
		}
	},

	_initSummary: function(container) {
		this._summary = new Summary({ summary: this.options.summary }, this);

		d3.select(container).call(this._summary.render());
	},

	_keydownHandler: function(e) {
		if(!this.options.detached && e.key === "Escape"){
			this._collapse()
		};
	},

	/**
	 * Retrieve data from a remote url (HTTP).
	 */
	_loadFile: function(url) {
		fetch(url)
			.then((response) => response.text())
			.then((data)     => {
				this._downloadURL = url; // TODO: handle multiple urls?
				this.load(data);
			})
			.catch((err) => console.warn(err));
	},

	/**
	 * Simple GeoJSON data loader (L.GeoJSON).
	 */
	_loadLayer: function(geojson) {
		let control = this;

		let { wptIcons, wptLabels } = control.options;

		let layer = L.geoJson(geojson, {
			distanceMarkers: control.options.distanceMarkers,
			style: (feature) => {
				let style = L.extend({}, control.options.polyline);
				if (control.options.theme) {
					style.className += ' ' + control.options.theme;
				}
				return style;
			},
			pointToLayer: (feature, latlng) => {
				if (!control.options.waypoints) return;

				let prop   = feature.properties;
				let desc   = prop.desc ?? '';
				let name   = prop.name ?? '';
				let sym    = (prop.sym ?? name).replace(' ', '-').replace('"', '').replace("'", '').toLowerCase();

				// Handle chart waypoints (dots)
				if ([true, 'dots'].includes(control.options.waypoints)) {
					control._registerCheckPoint({
						latlng: latlng,
						label: ([true, 'dots'].includes(wptLabels) ? name : '')
					});
				}

				// Handle map waypoints (markers)
				if ([true, 'markers'].includes(control.options.waypoints) && wptIcons != false) {
					// generate and cache appropriate icon symbol
					if (!wptIcons.hasOwnProperty(sym)) {
						wptIcons[sym] = L.divIcon(
							L.extend({}, wptIcons[""].options, { html: '<i class="elevation-waypoint-icon ' + sym + '"></i>' } )
						);
					}
					let marker = L.marker(latlng, { icon: wptIcons[sym] });
					if ([true, 'markers'].includes(wptLabels) && (name || desc)) {
						marker.bindPopup("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : '')).openPopup();
					}
					control._addMarker(marker);
					control._bindPopup(marker);
					control.fire('waypoint_added', { point: marker, element: latlng, properties: prop });
					return marker;
				}
			},
			onEachFeature: (feature, layer) => {
				if (feature.geometry && feature.geometry.type == 'Point') return;

				// Standard GeoJSON --> doesn't handle "time"
				// control.addData(feature, layer);  // NB make use of "_addGeoJSONData"
				
				// Extended GeoJSON --> rely on leaflet implementation
				layer._latlngs.forEach((point, i) => {
					// same properties as L.GPX layer
					point.meta = { time: null, ele: null, hr: null, cad: null, atemp: null };
					if("alt" in point) point.meta.ele = point.alt;
					if(feature.properties) {
						let prop = feature.properties;
						if("coordTimes" in prop) point.meta.time = new Date(Date.parse(prop.coordTimes[i]));
						else if("times" in prop) point.meta.time = new Date(Date.parse(prop.times[i]));
						else if("time" in prop) point.meta.time = new Date(Date.parse((typeof prop.time === 'object' ? prop.time[i] : prop.time)));
						if("heartRates" in prop) point.meta.hr = parseInt(prop.heartRates[i]);
						else if("heartRate" in prop) point.meta.hr = parseInt((typeof prop.heartRate === 'object' ? prop.heartRate[i] : prop.heartRate));
						// TODO: cadence, temperature
					}
				});
				control.addData(layer); // NB make use of "_addGPXData"

				control.track_info = L.extend({}, control.track_info, { name: geojson.name });
			},
		});

		control.lazyLoad(control.__D3).then(() => {
			let map   = control._map;
			if (map) {
				map.once('layeradd', (e) => control.options.autofitBounds && control.fitBounds(layer.getBounds()));
				if (!L.Browser.mobile) {
					control._initAlmostOverHandler(map, layer);
					control._initDistanceMarkers(map, layer);
				} else if (control.options.polyline) {
					layer.addTo(map);
				}
			} else {
				console.warn("Undefined elevation map object");;
			}

			control._fireEvt("eledata_loaded", { data: geojson, layer: layer, name: control.track_info.name, track_info: control.track_info })
		});

		return layer;
	},

	_dragendHandler: function(e) {
		this._hideMarker();
		this.fitBounds(L.latLngBounds([e.dragstart.latlng, e.dragend.latlng]));

		this._fireEvt("elechart_dragged");
	},

	/*
	 * Handles the moueseover the chart and displays distance and altitude level.
	 */
	_mousemoveHandler: function(e) {
		if (!this._data.length || !this._chartEnabled) {
			return;
		}
		let item = this._findItemForX(e.xCoord);

		if (item) {
			let xCoord = e.xCoord;

			if (this._chartEnabled) this._chart._showDiagramIndicator(item, xCoord);

			this._updateMarker(item);
			this._setMapView(item);

			if (this._map) {
				_.addClass(this._map.getContainer(), 'elechart-hover');
			}

			this._fireEvt("elechart_change", { data: item, xCoord: xCoord });
			this._fireEvt("elechart_hover",  { data: item, xCoord: xCoord });
		}
	},

	/*
	 * Handles mouseover events of the data layers on the map.
	 */
	_mousemoveLayerHandler: function(e) {
		if (!this._data.length) {
			return;
		}

		let item = this._findItemForLatLng(e.latlng);
		if (item) {
			let xCoord = item.xDiagCoord;

			if (this._chartEnabled) this._chart._showDiagramIndicator(item, xCoord);

			this._updateMarker(item);

			this._fireEvt("elechart_change", { data: item, xCoord: xCoord });
		}
	},

	/*
	 * Handles the moueseout over the chart.
	 */
	_mouseoutHandler: function() {
		if (!this.options.detached) {
			this._hideMarker();
			this._chart._hideDiagramIndicator();
		}

		if (this._map) {
			_.removeClass(this._map.getContainer(), 'elechart-hover');
		}

		this._fireEvt("elechart_leave");
	},

	/**
	 * Simple GeoJSON Parser
	 */
	_parseFromGeoJSONString: function(data) {
		try {
			return JSON.parse(data);
		} catch (e) { }
	},

	/**
	 * Attempt to parse raw response data (GeoJSON or XML > GeoJSON)
	 */
	_parseFromString: function(data) {
		return new Promise(resolve =>
			this.lazyLoad(this.__TOGEOJSON).then(() => {
				let geojson;
				try {
					geojson = this._parseFromXMLString(data.trim());
				} catch (e) {
					geojson = this._parseFromGeoJSONString(data.toString());
				}
				if (geojson) {
					geojson = this._prepareMultiLineStrings(geojson);
					geojson = this._prepareAdditionalProperties(geojson);
				}
				resolve(geojson);
			})
		);
	},

	/**
	 * Simple XML Parser (GPX, KML, TCX)
	 */
	_parseFromXMLString: function(data) {
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
		let geojson = toGeoJSON[type](xml);
		geojson.name = name.length > 0 ? Array.from(name).find(tag => tag.parentElement.tagName == "trk").textContent : '';
		return geojson;
	},

	/**
	 * Extend GeoJSON properties (name, time, ...)
	 */
	 _prepareAdditionalProperties: function(geojson){
		if (!geojson.name && this._downloadURL) {
			geojson.name = this._downloadURL.split('/').pop().split('#')[0].split('?')[0];
		}
		return geojson;
	},

	/**
	 * Just a temporary fix for MultiLineString data (trk > trkseg + trkseg),
	 * just split them into seperate LineStrings (trk > trkseg, trk > trkseg)
	 * 
	 * @link https://github.com/Raruto/leaflet-elevation/issues/56
	 */
	_prepareMultiLineStrings: function(geojson) {
		geojson.features.forEach(feauture => {
			if (feauture.geometry.type == "MultiLineString") {
				feauture.geometry.coordinates.forEach(coords => {
					geojson.features.push({
						geometry: { type: 'LineString', coordinates: coords },
						properties: feauture.properties,
						type: 'Feature'
					});
				});
			} 
		});
		return geojson.features.filter(feauture => feauture.geometry.type != "MultiLineString");
	},

	/**
	 * Add a point of interest over the diagram
	 */
	_registerCheckPoint: function(props) {
		this.on("elechart_updated", () => this._chart._registerCheckPoint(props));
	},

	/**
	 * Add chart profile to diagram
	 */
	_registerAreaPath: function(props) {
		this.on("elechart_init", () => this._chart._registerAreaPath(props));
	},

	/**
	 * Add chart grid to diagram
	 */
	_registerAxisGrid: function(props) {
		this.on("elechart_axis", () => this._chart._registerAxisGrid(props));
	},

	/**
	 * Add chart axis to diagram
	 */
	_registerAxisScale: function(props) {
		this.on("elechart_axis", () => this._chart._registerAxisScale(props));
	},

	/**
	 * Add chart or marker tooltip info
	 */
	 _registerTooltip: function(props) {
		if (props.chart) {
			let label = L.extend({}, props, { value: props.chart });
			this.on("elechart_init",   () => this._chart._registerTooltip(label));
		}
		if (props.marker) {
			let label = L.extend({}, props, { value: props.marker });
			this.on("elechart_marker", () => this._marker._registerTooltip(label));
		}
	},

	/**
	 * Add summary info to diagram
	 */
	_registerSummary: function(props) {
		this.on('elechart_summary',  () => this._summary._registerSummary(props));
	},

	/*
	 * Removes the drag rectangle and zoms back to the total extent of the data.
	 */
	_resetDrag: function() {
		this._chart._resetDrag();
		this._hideMarker();
	},

	/**
	 * Resets drag, marker and bounds.
	 */
	_resetView: function() {
		if (this._map && this._map._isFullscreen) return;
		this._resetDrag();
		this._hideMarker();
		if (this.options.autofitBounds) {
			this.fitBounds();
		}
	},

	/**
	 * Hacky way for handling chart resize. Deletes it and redraw chart.
	 */
	_resizeChart: function() {
		if(!this._container) return;

		// prevent displaying chart on resize if hidden
		if (_.style(this._container, "display") == "none") return;

		let opts = this.options;

		let newWidth;

		if (opts.detached) {
			newWidth = (this.eleDiv || this._container).offsetWidth;
		} else {
			let { clientWidth } = this._map.getContainer();
			newWidth = opts._maxWidth > clientWidth ? clientWidth - 30 : opts._maxWidth;
		}
		
		if (newWidth) {
			let chart  = this._chart;
			opts.width = newWidth;
			if (chart && chart._chart) {
				chart._chart._resize(opts);
				opts.xTicks = this._xTicks();
				opts.yTicks = this._yTicks();
				this._updateChart();
			}
		}

		this._updateMapSegments();
	},

	/**
	 * Handles the drag event over the ruler filter.
	 */
	_rulerFilterHandler: function(e) {
		this._updateMapSegments(e.coords);
	},

	/**
	 * Collapse or Expand current chart control.
	 */
	_toggle: function() {
		if (_.hasClass(this._container, "elevation-expanded"))
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
		let z    = this.options.zFollow;
		if (typeof z === "number") {
			this._map.setView(item.latlng, (zoom < z ? z : zoom), { animate: true, duration: 0.25 });
		} else if (!this._map.getBounds().contains(item.latlng)) {
			this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
		}
	},

	/**
	 * Toggle chart data on legend click
	 */
	_toggleChartHandler: function(e) {
		let { path, name, enabled } = e;

		this._chartEnabled = this._chart._hasActiveLayers();

		// toggle layer visibility on empty chart
		this._layers.eachLayer(layer => {
			let node = layer.getElement && layer.getElement();
			_.toggleClass(node, this.options.polyline.className + ' ' + this.options.theme, this._chartEnabled);
			}
		);

		// toggle option value (eg. altitude = { 'disabled' || 'disabled' })
		this.options[name] = !enabled && this.options[name] == 'disabled' ? 'enabled' : 'disabled';

		// remove marker on empty chart
		if (!this._chartEnabled) {
			this._chart._hideDiagramIndicator();
			this._marker.remove();
		}
	},

	/**
	 * Calculates [x, y] domain and then update chart.
	 */
	_updateChart: function() {
		if (/*!this._data.length ||*/ !this._chart || !this._container) return;

		this._fireEvt("elechart_axis");
		this._fireEvt("elechart_area");

		this._chart.update({ data: this._data, options: this.options });

		this._x     = this._chart._x;
		this._y     = this._chart._y;

		this._fireEvt('elechart_updated');
	},

	/*
	 * Update the position/height indicator marker drawn onto the map
	 */
	_updateMarker: function(item) {
		if (this._marker) {
			this._marker.update({
				map         : this._map,
				item        : item,
				maxElevation: this.track_info.elevation_max || 0,
				options     : this.options
			});
		}
	},

	/**
	 * Fix marker rotation on rotated maps
	 */
	_rotateMarker: function() {
		if (this._marker) {
			this._marker.update();
		}
	},

	/**
	 * Highlight track segments on the map.
	 */
	_updateMapSegments: function(coords) {
		this._markedSegments.setLatLngs(coords || []);
		if (coords && this._map && !this._map.hasLayer(this._markedSegments)) {
			this._markedSegments.addTo(this._map);
		}
	},

	/**
	 * Update chart summary.
	 */
	_updateSummary: function() {
		this._summary.reset();

		if (this.options.summary) {
			this._fireEvt("elechart_summary");
		}
		if (this.options.downloadLink && this._downloadURL) { // TODO: generate dynamically file content instead of using static file urls.
			this._summary._container.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>'
			_.select('.download a', this._summary._container).onclick = (e) => {
				e.preventDefault();
				if (e.downloadLink == 'modal' && typeof CustomEvent === "function") {
					document.dispatchEvent(new CustomEvent("eletrack_download", { detail: e }));
				} else if (e.downloadLink == 'link' || e.downloadLink === true) {
					e.confirm();
				}
				this._fireEvt('eletrack_download', { downloadLink: this.options.downloadLink, confirm: _.saveFile.bind(this, this._downloadURL) });
			};
		};
	},


	/**
	 * Calculates chart width.
	 */
	_width: function() {
		if (this._chart) return this._chart._width();
		let opts = this.options;
		return opts.width - opts.margins.left - opts.margins.right;
	},

	/**
	 * Calculate chart xTicks
	 */
	_xTicks: function() {
		if (this.__xTicks) this.__xTicks = this.options.xTicks;
		return this.__xTicks || Math.round(this._width() / 75);
	},

	/**
	 * Calculate chart yTicks
	 */
	_yTicks: function() {
		if (this.__yTicks) this.__yTicks = this.options.yTicks;
		return this.__yTicks || Math.round(this._height() / 30);
	}

});