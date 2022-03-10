import 'leaflet-i18n';
import * as _      from './utils';
import { Options } from './options';

export const Elevation = L.Control.Elevation = L.Control.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	options: Options,
	__mileFactor: 0.621371, // 1 km = (0.621371 mi)
	__footFactor: 3.28084,  // 1 m  = (3.28084 ft)
	__D3:            'https://unpkg.com/d3@6.5.0/dist/d3.min.js',
	__TOGEOJSON:     'https://unpkg.com/@tmcw/togeojson@4.6.0/dist/togeojson.umd.js',
	__LGEOMUTIL:     'https://unpkg.com/leaflet-geometryutil@0.9.3/src/leaflet.geometryutil.js',
	__LALMOSTOVER:   'https://unpkg.com/leaflet-almostover@1.0.1/src/leaflet.almostover.js',
	__LDISTANCEM:    '../libs/leaflet-distance-marker.min.js',
	__LCHART:        '../src/components/chart.js',
	__LMARKER:       '../src/components/marker.js',
	__LSUMMARY:      '../src/components/summary.js',
	__modulesFolder: '../src/handlers/',

	/*
	 * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
	 */
	addData: function(d, layer) {
		this.import(this.__D3)
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
		if (this._marker)        this._marker.remove();
		if (this._chart)         this._clearChart();
		if (this._layers)        this._clearLayers(this._layers);
		if (this._markers)       this._clearLayers(this._markers);
		if (this._circleMarkers) this._clearLayers(this._circleMarkers);

		this._data      = [];
		this.track_info = {};

		this._fireEvt("eledata_clear");

		this._updateChart();
	},

	_clearChart: function() {
		if (this._events && this._events.elechart_updated) {
			this._events.elechart_updated.forEach(({fn, ctx}) => this.off('elechart_updated', fn, ctx));
		}
		if (this._chart && this._chart._container) {
			this._chart._container.selectAll('g.point .point').remove();
			this._chart.clear();
		}
	},

	_clearLayers: function(l) {
		l = l || this._layers;
		if (l && l.eachLayer) {
			l.eachLayer(f => f.remove())
			l.clearLayers();
		}
	},

	/**
	 * TODO: Create a base class to handle custom data attributes (heart rate, cadence, temperature, ...)
	 * 
	 * @link https://leafletjs.com/examples/extending/extending-3-controls.html#handlers
	 */
	// addHandler: function (name, HandlerClass) {
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
		return L.latLngBounds((data || this._data).map((d) => d.latlng));
	},

	/**
	 * Get default zoom level (followMarker: true).
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
	initialize: function(opts) {

		opts = L.setOptions(this, opts);

		this._data           = [];
		this._layers         = L.featureGroup();
		this._markers        = L.featureGroup();
		this._circleMarkers  = L.featureGroup();
		this._markedSegments = L.polyline([]);
		this._start          = (opts.trkStart || Options.trkStart);
		this._end            = (opts.trkEnd || Options.trkEnd);
		this._chartEnabled   = true;
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
		L.extend(_.Colors, opts.colors || {});

		// Various stuff
		this._fixCanvasPaths();
		this._fixTooltipSize();

	},

	/**
	 * Javascript scripts downloader (lazy loader)
	 */
	import: function(src, condition) {
		switch(src) {
			case this.__D3:          condition = typeof d3 !== 'object'; break;
			case this.__TOGEOJSON:   condition = typeof toGeoJSON !== 'object'; break;
			case this.__LGEOMUTIL:   condition = typeof L.GeometryUtil !== 'object'; break;
			case this.__LALMOSTOVER: condition = typeof L.Handler.AlmostOver  !== 'function'; break;
			case this.__LDISTANCEM:  condition = typeof L.DistanceMarkers  !== 'function'; break;
		}
		return condition !== false ? import(src) : Promise.resolve();
	},

	/**
	 * Load elevation data (GPX, GeoJSON, KML or TCX).
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

		let modules = [
			"Distance",
			"Time",
			"Altitude",
			"Slope",
			"Speed",
			"Acceleration",
			...this.options.handlers
		].filter(m => false !== this.options[typeof m == "string" && m.toLowerCase()]);

		this._loadModules(modules);	// Inject here required modules (data handlers)
		this._initButton(container);
		this._initChart(container);
		this._initSummary(container);
		this._initMarker(map);
		this._initLayer(map);

		return container;
	},

	/**
	 * Clean up control code and related event listeners.
	 * Called on control.remove().
	 */
	onRemove: function(map) {
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
			.off('eledata_added eledata_loaded', this._updateSummary, this);
	},

	/**
	 * Redraws the chart control. Sometimes useful after screen resize.
	 */
	redraw: function() {
		this._resizeChart();
	},

	/**
	 * Set default zoom level (followMarker: true).
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

		/**
		 * Standard GeoJSON --> doesn't handle "time", "heart", …
		 */
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
					return console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
			}
		}
		if (d.type === "FeatureCollection") {
			_.each(d.features, feature => this._addData(feature));
		}

		/**
		 * Extended GeoJSON --> rely on leaflet implementation
		 */
		if (d._latlngs) {
			this._addGeoJSONData(d._latlngs, d.feature && d.feature.properties);
		}
	},

	/*
	 * Parsing of GeoJSON data lines and their elevation in z-coordinate
	 */
	_addGeoJSONData: function(coords, properties) {
		coords.forEach((point, i) => {

			// GARMIN_EXTENSIONS = ["hr", "cad", "atemp", "wtemp", "depth", "course", "bearing"];
			point.meta = point.meta ?? { time: null, ele: null };
			
			// "coordinateProperties" property is generated inside "@tmcw/toGeoJSON"
			let props  = (properties && properties.coordinateProperties) || properties;

			point.prev = (attr) => (attr ? this._data[i > 0 ? i - 1 : 0][attr] : this._data[i > 0 ? i - 1 : 0]);

			this.fire("elepoint_init", { point: point, props: props, id: i });

			this._addPoint(
				point.lat ?? point[1], 
				point.lng ?? point[0],
				point.alt ?? point.meta.ele ?? point[2]
			);

			this.fire("elepoint_added", { point: point, index: this._data.length - 1 });

			if (this._yCoordMax < this._data[this._data.length - 1][this.options.yAttr]) this._yCoordMax = this._data[this._data.length - 1][this.options.yAttr];
		});

		this.fire("eletrack_added", { coords: coords, index: this._data.length - 1 });
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

		this.fire("eledata_updated", { index: this._data.length - 1 });
	},

	_addLayer: function(layer) {
		if (layer) this._layers.addLayer(layer)
		// Postpone adding the distance markers (lazy: true)
		if (layer && this.options.distanceMarkers && this.options.distanceMarkers.lazy) {
			layer.on('add remove', ({target, type}) => L.DistanceMarkers && target instanceof L.Polyline && target[type + 'DistanceMarkers']());
		}
	},

	_addMarker: function(marker) {
		if (marker) this._markers.addLayer(marker)
	},

	/**
	 * Initialize "L.AlmostOver" integration
	 */
	_initAlmostOverHandler: function(map, layer) {
		if(!map || !this.options.almostOver) return;
		Promise.all([
			this.import(this.__LGEOMUTIL),
			this.import(this.__LALMOSTOVER)
		]).then(() => {
			map.addHandler('almostOver', L.Handler.AlmostOver)
			if (L.GeometryUtil && map.almostOver && map.almostOver.enabled()) {
				map.almostOver.addLayer(layer);
				map
					.on('almost:move', (e) => this._onMouseMoveLayer(e))
					.on('almost:out',  (e) => this._onMouseOut(e));
			}
		});
	},

	/**
	 * Initialize "L.DistanceMarkers" integration
	 */
	_initDistanceMarkers: function(map, layer) {
		if (!map) return;
		if (this.options.distanceMarkers) {
			Promise.all([
				this.import(this.__LGEOMUTIL),
				this.import(this.__LDISTANCEM)
			]).then(() => this.options.polyline && layer.addTo(map) && this._circleMarkers.bringToFront());
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

	/**
	 * Initialize "L.AlmostOver" and "L.DistanceMarkers"
	 */
	_initMapIntegrations: function(control, layer) {
		let map   = control._map;
		if (control._data.length) {
			control._start.setLatLng(control._data[0].latlng);
			control._end.setLatLng(control._data[control._data.length -1].latlng);
		}
		if (map) {
			control._circleMarkers.addTo(map);
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

		let theme      = this.options.theme.replace('-theme', '');
		let color      = _.Colors[theme] || {};

		L.Canvas.include({
			_fillStroke: function(ctx, layer) {
				if (control._layers.hasLayer(layer)) {

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
			this.once('elechart_change elechart_hover', ({data, xCoord}) => {
				if (this._chartEnabled) {
					this._chart._showDiagramIndicator(data, xCoord);
					this._chart._showDiagramIndicator(data, xCoord);
				}
				this._updateMarker(data);
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

	/*
	 * Hides the position/height indicator marker drawn onto the map
	 */
	_hideMarker: function() {
		if (this.options.autohideMarker) {
			this._marker.remove();
		}
	},

	/**
	 * Generate "svg" chart (DOM element).
	 */
	_initChart: function(container) {
		let opts    = this.options;

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

		Promise.all([
			this.import(this.__D3),
			this.import(this.__LCHART)
		]).then((m) => {

			let chart = this._chart = new (m[1] || Elevation).Chart(opts, this);
	
			this._x     = this._chart._x;
			this._y     = this._chart._y;
	
			d3
				.select(container)
				.call(chart.render())
	
			chart
				.on('reset_drag',      this._hideMarker,     this)
				.on('mouse_enter',     this._onMouseEnter,   this)
				.on('dragged',         this._onDragEnd,      this)
				.on('mouse_move',      this._onMouseMove,    this)
				.on('mouse_out',       this._onMouseOut,     this)
				.on('ruler_filter',    this._onRulerFilter,  this)
				.on('zoom',            this._updateChart,    this)
				.on('elepath_toggle',  this._onToggleChart,  this)
				.on('margins_updated', this._resizeChart,    this);
	
	
			this.fire("elechart_axis");
	
			if (this.options.legend) this.fire("elechart_legend");
	
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
		});

	},

	_initLayer: function() {
		this._layers
			.on('layeradd layerremove', ({layer, type}) => {
				let node  = layer.getElement && layer.getElement();
				_.toggleClass(node,  this.options.polyline.className + ' ' + this.options.theme, type == 'layeradd');
				_.toggleEvent(layer, "mousemove", this._onMouseMoveLayer.bind(this),             type == 'layeradd')
				_.toggleEvent(layer, "mouseout",  this._onMouseOut.bind(this),                   type == 'layeradd');
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

		Promise.all([
			this.import(this.__D3),
			this.import(this.__LMARKER)
		]).then((m) => {
			this._marker             = new (m[1] || Elevation).Marker(this.options, this);
			this.fire("elechart_marker");
		});
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
		this.import(this.__LSUMMARY).then((m)=>{
			this._summary = new (m || Elevation).Summary({ summary: this.options.summary }, this);

			this.on('elechart_init', () => {
				d3.select(container).call(this._summary.render());
			});
		});
	},

	/**
	 * Retrieve data from a remote url (HTTP).
	 */
	_loadFile: function(url) {
		fetch(url)
			.then((response) => response.text())
			.then((data)     => {
				this._downloadURL = url; // TODO: handle multiple urls?
				this._parseFromString(data)
					.then( geojson => geojson && this._loadLayer(geojson));
			}).catch((err) => console.warn(err));
	},

	/**
	 * Dynamically import only required javascript modules (code splitting)
	 */
	_loadModules: function(handlers) {
		// First map known classnames (eg. "Altitude" --> L.Control.Elevation.Altitude)
		handlers = handlers.map((h) => typeof h === 'string' && typeof L.Control.Elevation[h] !== "undefined" ? L.Control.Elevation[h] : h);
		// Then load optional classes and custom imports (eg. "Cadence" --> import('../src/handlers/cadence.js'))
		Promise.
			all(
				handlers
					.filter(h => typeof h === 'string' || h instanceof Promise)
					.map(file => file instanceof Promise ? file : this.import(this.__modulesFolder + file.toLowerCase() + '.js'))
			)
			.then((m) => {
				_.each(m, (exported) => {
					let fn = Object.keys(exported)[0];
					if (fn && typeof L.Control.Elevation[fn] === "undefined" ) {
						handlers[fn] = L.Control.Elevation[fn] = exported[fn];
						
					}
				});
				_.each(handlers, h => this._registerHandler(h));
			});
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
						let content = decodeURI("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : ''));
						marker.bindPopup(content, { className: 'elevation-popup', keepInView: true }).openPopup();
						marker.bindTooltip(content, { className: 'elevation-tooltip', direction: 'auto', sticky: true, opacity: 1 }).openTooltip();
					}
					control._addMarker(marker);
					control.fire('waypoint_added', { point: marker, element: latlng, properties: prop });
					return marker;
				}
			},
			onEachFeature: (feature, layer) => {
				if (feature.geometry && feature.geometry.type != 'Point') {
					control.addData(layer);
					control.track_info = L.extend({}, control.track_info, { name: geojson.name });
				} 
			},
		});

		control.import(control.__D3).then(() => {
			control._initMapIntegrations(control, layer);
			control._fireEvt("eledata_loaded", { data: geojson, layer: layer, name: control.track_info.name, track_info: control.track_info });
		});

		return layer;
	},

	_onDragEnd: function({ dragstart, dragend}) {
		this._hideMarker();
		this.fitBounds(L.latLngBounds([dragstart.latlng, dragend.latlng]));

		this.fire("elechart_dragged");
	},

	_onKeyDown: function({key}) {
		if(!this.options.detached && key === "Escape"){
			this._collapse()
		};
	},

	/**
	 * Trigger mouseenter event.
	 */
	_onMouseEnter: function() {
		this.fire('elechart_enter');
	},

	/*
	 * Handles the moueseover the chart and displays distance and altitude level.
	 */
	_onMouseMove: function({xCoord}) {
		if (this._chartEnabled && this._data.length) {
			let item = this._findItemForX(xCoord);
			if (item) {
				if (this._chartEnabled) this._chart._showDiagramIndicator(item, xCoord);

				this._updateMarker(item);
				this._setMapView(item);

				if (this._map) {
					_.addClass(this._map.getContainer(), 'elechart-hover');
				}

				this.fire("elechart_change", { data: item, xCoord: xCoord });
				this.fire("elechart_hover",  { data: item, xCoord: xCoord });
			}
		}
	},

	/*
	 * Handles mouseover events of the data layers on the map.
	 */
	_onMouseMoveLayer: function({latlng}) {
		if (this._data.length) {
			let item = this._findItemForLatLng(latlng);
			if (item) {
				let xCoord = item.xDiagCoord;
	
				if (this._chartEnabled) this._chart._showDiagramIndicator(item, xCoord);
	
				this._updateMarker(item);
	
				this.fire("elechart_change", { data: item, xCoord: xCoord });
			}
		}
	},

	/*
	 * Handles the moueseout over the chart.
	 */
	_onMouseOut: function() {
		if (!this.options.detached) {
			this._hideMarker();
			this._chart._hideDiagramIndicator();
		}

		if (this._map) {
			_.removeClass(this._map.getContainer(), 'elechart-hover');
		}

		this.fire("elechart_leave");
	},

	/**
	 * Handles the drag event over the ruler filter.
	 */
	_onRulerFilter: function({coords}) {
		this._updateMapSegments(coords);
	},

	/**
	 * Toggle chart data on legend click
	 */
	_onToggleChart: function({ name, enabled }) {

		this._chartEnabled = this._chart._hasActiveLayers();

		// toggle layer visibility on empty chart
		this._layers.eachLayer(layer => _.toggleClass(layer.getElement && layer.getElement(), this.options.polyline.className + ' ' + this.options.theme, this._chartEnabled));

		// toggle option value (eg. altitude = { 'disabled' || 'enabled' })
		this.options[name] = !enabled && this.options[name] == 'disabled' ? 'enabled' : 'disabled';

		// remove marker on empty chart
		if (!this._chartEnabled) {
			this._chart._hideDiagramIndicator();
			this._marker.remove();
		}
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
			this.import(this.__TOGEOJSON).then(() => {
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
		let geojson  = toGeoJSON[type](xml);
		geojson.name = name.length > 0 ? (Array.from(name).find(tag => tag.parentElement.tagName == "trk") ?? name[0]).textContent : '';
		return geojson;
	},

	/**
	 * Extend GeoJSON properties (name, time, ...)
	 */
	 _prepareAdditionalProperties: function(geojson) {
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
	 * Add a point of interest over the diagram
	 */
	_registerCheckPoint: function(props) {
		this.on("elechart_updated", () => this._chart._registerCheckPoint(props));
	},


	/**
	 * Base handler for iterative track statistics (dist, time, z, slope, speed, acceleration, ...)
	 */
	 _registerDataAttribute: function(props) {

		// parse of "coordinateProperties" for later usage
		if (props.coordPropsToMeta) {
			this.on("elepoint_init", (e) => props.coordPropsToMeta.call(this, e));
		}

		// prevent excessive variabile instanstations
		let i, curr, prev, attr;

		// save here a reference to last used point
		let lastValid = null; 

		// iteration
		this.on("elepoint_added", ({index, point}) => {
			i = index;

			prev = curr ?? this._data[i]; // same as: this._data[i > 0 ? i - 1 : i]
			curr = this._data[i];
			attr = props.attr || props.name;

			// check and fix missing data on last added point
			if (props.skipNull === false) {
				let curr = this._data[i][attr];
				if(i > 0) {
					let prev = this._data[i - 1][attr];
					if (isNaN(prev)) {
						if (!isNaN(lastValid) && !isNaN(curr)) {
							prev   = (lastValid + curr) / 2;
						} else if (!isNaN(lastValid)) {
							prev   = lastValid;
						} else if (!isNaN(curr)) {
							prev   = curr;
						}
						if (!isNaN(prev)) return this._data.splice(i - 1, 1);
						this._data[i - 1][attr] = prev;
					}
				}
				// update reference to last used point (ie. if it has data)
				if (!isNaN(curr)) {
					lastValid = curr;
				}
			}

			// retrieve point value
			curr[attr] = props.pointToAttr.call(this, point, i);

			// update "track_info" stats (min, max, avg, ...)
			if (props.stats) {
				for (const key in props.stats) {
					let sname = (props.statsName || attr) + (key != '' ? '_' : '');
					this.track_info[sname + key] = props.stats[key].call(this, curr[attr], this.track_info[sname + key]);
				}
			}

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

			// update here some mixins (eg. complex "track_info" stuff)
			if(props.onPointAdded) props.onPointAdded.call(this, curr[attr], i, point);
		});
	},

	/**
	 * Parse a module definition and attach related function listeners
	 */
	_registerHandler: function(props) {

		// eg. L.Control.Altitude
		if (typeof props === "function") {
			return this._registerHandler(props.call(this));
		}

		// eg. "altitude" == true
		if (this.options[props.name] || props.required) {

			this._registerDataAttribute({
				name: props.name,
				attr: props.attr,
				skipNull: props.skipNull,
				deltaMax: props.deltaMax,
				clampRange: props.clampRange,
				decimals: props.decimals,
				coordPropsToMeta: _.coordPropsToMeta(props.coordinateProperties, props.meta || props.name, props.coordPropsToMeta),
				pointToAttr: props.pointToAttr,
				onPointAdded: props.onPointAdded,
				stats: props.stats,
				statsName: props.statsName,
			});

			if (props.grid) {
				props.grid.name = props.grid.name || props.name;
				this._registerAxisGrid(props.grid);
			}

			if (this.options[props.name] !== "summary") {
				if (props.scale) {
					props.scale.name = props.scale.name || props.name;
					props.scale.label = props.scale.label || props.unit;
					this._registerAxisScale(props.scale);
				}
				if (props.path) {
					props.path.name = props.path.name || props.name;
					this._registerAreaPath(props.path);
				}
			}

			if (props.tooltips) {
				_.each(props.tooltips, t => {
					if (t) {
						t.name = t.name || props.name;
						this._registerTooltip(t)
					}
				});
			} else if (props.tooltip) {
				props.tooltip.name = props.tooltip.name || props.name;
				this._registerTooltip(props.tooltip)
			}

			if (props.summary) {
				for (const key in props.summary) {
					props.summary[key].unit = props.summary[key].unit || props.unit;
				}
				this._registerSummary(props.summary);
			}
		}
	},
	
	/**
	 * Add chart or marker tooltip info
	 */
	_registerTooltip: function(props) {
		props.chart  && this.on("elechart_init",   () => this._chart._registerTooltip(L.extend({}, props, { value: props.chart })));
		props.marker && this.on("elechart_marker", () => this._marker._registerTooltip(L.extend({}, props, { value: props.marker })));
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
	},

	/**
	 * Collapse or Expand chart control.
	 */
	_toggle: function() {
		_.hasClass(this._container, "elevation-expanded") ? this._collapse() : this._expand();
	},

	/**
	 * Update map center and zoom (followMarker: true)
	 */
	_setMapView: function(item) {
		if (this._map && this.options.followMarker) {
			let zoom = this._map.getZoom();
			let z    = this.options.zFollow;
			if (typeof z === "number") {
				this._map.setView(item.latlng, (zoom < z ? z : zoom), { animate: true, duration: 0.25 });
			} else if (!this._map.getBounds().contains(item.latlng)) {
				this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
			}
		}
	},

	/**
	 * Calculates [x, y] domain and then update chart.
	 */
	_updateChart: function() {
		if (this._chart && this._container) {
			this.fire("elechart_axis");
			this.fire("elechart_area");
	
			this._chart.update({ data: this._data, options: this.options });
	
			this._x     = this._chart._x;
			this._y     = this._chart._y;
	
			this.fire('elechart_updated');		
		}
	},

	/*
	 * Update the position/height indicator marker drawn onto the map
	 */
	_updateMarker: function(item) {
		if (this._marker) {
			this._marker.update({
				map         : this._map,
				item        : item,
				yCoordMax   : this._yCoordMax || 0,
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
		if (!this._summary) return;

		this._summary.reset();

		if (this.options.summary) {
			this.fire("elechart_summary");
			this._summary.update();
		}
		if (this.options.downloadLink && this._downloadURL) { // TODO: generate dynamically file content instead of using static file urls.
			this._summary._container.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>'
			_.select('.download a', this._summary._container).onclick = ({preventDefault}) => {
				preventDefault();
				let event = { downloadLink: this.options.downloadLink, confirm: _.saveFile.bind(this, this._downloadURL) };
				if (this.options.downloadLink == 'modal' && typeof CustomEvent === "function") {
					document.dispatchEvent(new CustomEvent("eletrack_download", { detail: event }));
				} else if (this.options.downloadLink == 'link' || this.options.downloadLink === true) {
					event.confirm();
				}
				this.fire('eletrack_download', event);
			};
		};
	},


	/**
	 * Calculates chart width.
	 */
	_width: function() {
		if (this._chart) return this._chart._width();
		const { width, margins } = this.options;
		return width - margins.left - margins.right;
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		if (this._chart) return this._chart._height();
		const { height, margins } = this.options;
		return height - margins.top - margins.bottom;
	},

});