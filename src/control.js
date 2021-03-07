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
	__D3: 'https://unpkg.com/d3@6.5.0/dist/d3.min.js',
	__TOGEOJSON: 'https://unpkg.com/@tmcw/togeojson@4.3.0/dist/togeojson.umd.js',
	__LGEOMUTIL: 'https://unpkg.com/leaflet-geometryutil@0.9.3/src/leaflet.geometryutil.js',
	__LALMOSTOVER: 'https://unpkg.com/leaflet-almostover@1.0.1/src/leaflet.almostover.js',

	/**
	 * Add a waypoint marker to the diagram
	 */
	addCheckpoint: function(checkpoint, skipUpdate = false) {
		this.on("elechart_updated", function() {
			if(!this._data.length) return;
			this._chart._addCheckpoint(checkpoint);
		});
		if(!skipUpdate) this._updateChart();
	},

	/*
	 * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
	 */
	addData: function(d, layer) {
		if ((typeof layer === "undefined" || layer === null) && d.on) {
			layer = d;
		}
		Elevation._d3LazyLoader = _.lazyLoader(
			this.__D3,
			typeof d3 !== 'object' || !this.options.lazyLoadJS,
			Elevation._d3LazyLoader
		).then(() => {
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
		if (this._chart)  this._chart.clear();
		if (this._layers) this._layers.clearLayers();

		this._data      = [];
		this.track_info = {};

		this._fireEvt("eledata_clear");
	},

	/**
	 * Disable dragging chart on touch events.
	 */
	disableDragging: function() {
		this._chart._draggingEnabled = false;
		this._resetDrag();
	},

	/**
	 * Enable dragging chart on touch events.
	 */
	enableDragging: function() {
		this._chart._draggingEnabled = true;
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
		return this._zFollow;
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
		this._markedSegments = L.polyline([]);
		this._chartEnabled   = true,

		this.track_info      = {};

		this.options         = _.deepMerge({}, this.options, options);

		this._zFollow        = this.options.zFollow;

		if (this.options.followMarker) this._setMapView = L.Util.throttle(this._setMapView, 300, this);
		if (this.options.placeholder)  this.options.loadData.lazy = this.options.loadData.defer = true;

		if (this.options.legend)       this.options.margins.bottom += 30;

		if (this.options.theme)        this.options.polylineSegments.className += ' ' + this.options.theme;

		this._markedSegments.setStyle(this.options.polylineSegments);

		if (L.Browser.mobile) {
			this._updateChart   = _.debounce(this._updateChart,   300, this);
			this._updateSummary = _.debounce(this._updateSummary, 300, this);
			this._resizeChart   = _.debounce(this._resizeChart,   300, this);
		}
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
	 * Load elevation data (GPX, GeoJSON or KML).
	 */
	loadData: function(data, opts) {
		opts = L.extend({}, this.options.loadData, opts);
		if (opts.defer) {
			this.loadDefer(data, opts);
		} else if (opts.lazy) {
			this.loadLazy(data, opts);
		} else if (_.isXMLDoc(data)) {
			this.loadXML(data);
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
		opts       = L.extend({}, this.options.loadData, opts);
		opts.defer = false;
		_.deferFunc(L.bind(this.loadData, this, data, opts));
	},

	/**
	 * Load data from a remote url.
	 */
	loadFile: function(url) {
		fetch(url)
			.then((response) => response.text())
			.then((data)     => {
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
	 * Alias for loadXML
	 */
	loadGPX: function(data){
		this.loadXML(data);
	},

	/**
	 * Load raw XML data.
	 */
	loadXML: function(data) {
		Elevation._togeojsonLazyLoader = _.lazyLoader(
			this.__TOGEOJSON,
			typeof toGeoJSON !== 'function' || !this.options.lazyLoadJS,
			Elevation._togeojsonLazyLoader
		).then(
			() => {
				let xml     = (new DOMParser()).parseFromString(data, "text/xml");
				let type    = xml.documentElement.tagName.toLowerCase(); // "kml" or "gpx"
				if (!(type in toGeoJSON)) {
					type = xml.documentElement.tagName == "TrainingCenterDatabase" ? 'tcx' : 'gpx';
				}
				let geojson = toGeoJSON[type](xml);
				let name    = xml.getElementsByTagName('name');
				if(name[0]) { geojson.name = name[0].innerHTML; }
				else if(this._downloadURL) { geojson.name = this._downloadURL.split('/').pop().split('#')[0].split('?')[0]; }

				return this.loadGeoJSON(geojson, this);
			}
		);
	},

	/**
	 * Wait for chart container visible before download data.
	 */
	loadLazy: function(data, opts) {
		opts     = L.extend({}, this.options.loadData, opts);
		let elem = opts.lazy.parentNode ? opts.lazy : this.placeholder;
		_.waitHolder(elem)
			.then(() => {
				opts.lazy = false;
				this.loadData(data, opts)
				this.once('eledata_loaded', () => this.placeholder.parentNode.removeChild(elem));
			});
	},

	/**
	 * Create container DOM element and related event listeners.
	 * Called on control.addTo(map).
	 */
	onAdd: function(map) {
		this._map = map;

		let container = this._container = _.create("div", "elevation-control elevation " + this.options.theme);

		if (!this.options.detached) {
			_.addClass(container, 'leaflet-control');
		}

		if (this.options.placeholder && !this._data.length) {
			this.placeholder = _.create('img', 'elevation-placeholder', typeof this.options.placeholder === 'string' ? { src: this.options.placeholder, alt: '' } : this.options.placeholder);
			_.insert(container, this.placeholder, 'afterbegin');
		}

		Elevation._d3LazyLoader = _.lazyLoader(
			this.__D3,
			typeof d3 !== 'object' || !this.options.lazyLoadJS,
			Elevation._d3LazyLoader
		).then(() => {
			this._initButton(container);
			this._initChart(container);
			this._initSummary(container);
			this._initMarker(map);
			this._initLayer(map);

			map
				.on('zoom viewreset zoomanim',       this._hideMarker,    this)
				.on('resize',                        this._resetView,     this)
				.on('resize',                        this._resizeChart,   this)
				.on('mousedown',                     this._resetDrag,     this);

			_.on(map.getContainer(), 'mousewheel', this._resetDrag,     this);
			_.on(map.getContainer(), 'touchstart', this._resetDrag,     this);

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

		_.off(map.getContainer(), 'mousewheel', this._resetDrag,     this);
		_.off(map.getContainer(), 'touchstart', this._resetDrag,     this);

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
		this._zFollow = zoom;
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
			this._addPoint(point.lat, point.lng, point.meta.ele);
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
		this.eleDiv = eleDiv;
		return this.eleDiv;
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
		opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
		opts.yTicks = opts.yTicks || Math.round(this._height() / 30);

		if (opts.responsive) {
			if (opts.detached) {
				let offWi          = this.eleDiv.offsetWidth;
				let offHe          = this.eleDiv.offsetHeight;
				opts.width         = offWi > 0 ? offWi : opts.width;
				opts.height        = (offHe - 20) > 0 ? offHe - 20 : opts.height; // 20 = horizontal scrollbar size.
			} else {
				opts._maxWidth     = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;
				let containerWidth = this._map.getContainer().clientWidth;
				opts.width         = opts._maxWidth > containerWidth ? containerWidth - 30 : opts.width;
			}
		}

		let chart = this._chart = new Chart(opts);

		d3
			.select(container)
			.call(chart.render())

		chart
			.on('reset_drag',   this._hideMarker,                     this)
			.on('mouse_enter',  this._fireEvt.bind('elechart_enter'), this)
			.on('dragged',      this._dragendHandler,                 this)
			.on('mouse_move',   this._mousemoveHandler,               this)
			.on('mouse_out',    this._mouseoutHandler,                this)
			.on('ruler_filter', this._rulerFilterHandler,             this)
			.on('zoom',         this._updateChart,                    this);

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
		let pane                   = map.getPane('elevationPane');
		if (!pane) {
			pane = this._pane        = map.createPane('elevationPane', map.getPane('rotatePane') || map.getPane('mapPane'));
			pane.style.zIndex        = 625; // This pane is above markers but below popups.
			pane.style.pointerEvents = 'none';
		}

		if (this._renderer) this._renderer.remove()
		this._renderer             = L.svg({ pane: "elevationPane" }).addTo(this._map); // default leaflet svg renderer
		this._marker               = new Marker(this.options);
	},

	/**
	 * Inspired by L.Control.Layers
	 */
	_initButton: function(container) {
		//Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!this.options.detached) {
			L.DomEvent
				.disableClickPropagation(container);
			//.disableScrollPropagation(container);
		}

		if (L.Browser.mobile) {
			_.on(container, 'click', L.DomEvent.stopPropagation);
		}

		_.on(container, 'mousewheel', this._mousewheelHandler, this);

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
				// TODO: keyboard accessibility
			}
		} else {
			// TODO: handle autohide when detached=true
		}
	},

	_initSummary: function(container) {
		let summary = this._summary = new Summary({ summary: this.options.summary });

		d3
			.select(container)
			.call(summary.render());

		this.summaryDiv = this._summary._container;
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

	/*
	 * Handles the mouesewheel over the chart.
	 */
	_mousewheelHandler: function(e) {
		if (this._map.gestureHandling && this._map.gestureHandling._enabled) return;
		let ll = this._marker.getLatLng() || this._map.getCenter();
		let z  = this._map.getZoom() + Math.sign(e.deltaY);
		this._resetDrag();
		this._map.flyTo(ll, z);
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
		// prevent displaying chart on resize if hidden
		if (_.style(this._container, "display") == "none") return;

		if (this.options.responsive) {
			if (this.options.detached) {
				let newWidth            = this.eleDiv.offsetWidth; // - 20;
				if (newWidth) {
					this.options.width    = newWidth;
					this.eleDiv.innerHTML = "";
					_.append(this.eleDiv, this.onAdd(this._map));
				}
			} else {
				this._map.removeControl(this._container);
				this.addTo(this._map);
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
		if ("number" === typeof this._zFollow) {
			zoom   = zoom < this._zFollow ? this._zFollow : zoom;
			this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
		} else if (!this._map.getBounds().contains(item.latlng)) {
			this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
		}
	},

	/**
	 * Calculates [x, y] domain and then update chart.
	 */
	_updateChart: function() {
		if (!this._data.length || !this._container) return;

		this._chart = this._chart.update({ data: this._data });

		this._x     = this._chart._x;
		this._y     = this._chart._y;

		this._fireEvt("elechart_axis");
		this._fireEvt("elechart_area");

		this._fireEvt('elechart_updated');
	},

	/*
	 * Update the position/height indicator marker drawn onto the map
	 */
	_updateMarker: function(item) {
		this._marker.update({
			map         : this._map,
			item        : item,
			maxElevation: this._maxElevation,
			options     : this.options
		});
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
			this.summaryDiv.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>'
			_.select('.download a', this.summaryDiv).onclick = (e) => {
				e.preventDefault();
				this._fireEvt('eletrack_download', { downloadLink: this.options.downloadLink, confirm: _.saveFile.bind(this, this._downloadURL) });
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

/**
 * Attach here some useful elevation hooks.
 */
Elevation.addInitHook(function() {

	this.on('waypoint_added', function(e) {
		let p = e.point,
			pop = p._popup;
		if (pop) {
			pop.options.className = 'elevation-popup';
		}
		if (pop && pop._content) {
			pop._content = decodeURI(pop._content);
			p.bindTooltip(pop._content, { direction: 'auto', sticky: true, opacity: 1, className: 'elevation-tooltip' }).openTooltip();
		}
	});

	// autotoggle chart data on click
	this.on('elepath_toggle', function(e) {
		let path              = e.path;
		let optName           = path.getAttribute('data-name').toLowerCase();
		let enabled           = !_.hasClass(path, 'leaflet-hidden');
		let label             = _.select('text', e.legend);
		let rect              = _.select('rect', e.legend);

		_.toggleStyle(label, 'text-decoration-line', 'line-through', enabled);
		_.toggleStyle(rect,  'fill-opacity',         '0',            enabled);
		_.toggleClass(path,  'leaflet-hidden',                       enabled);

		this._chartEnabled    = this._chart._area.selectAll('path:not(.leaflet-hidden)').nodes().length != 0;

		this._layers.eachLayer(layer => {
			let node = layer.getElement && layer.getElement();
			_.toggleClass(node, this.options.polyline.className + ' ' + this.options.theme, this._chartEnabled);
			}
		);

		this.options[optName] = !enabled && this.options[optName] == 'disabled' ? 'enabled' : 'disabled';

		if (!this._chartEnabled) {
			this._chart._hideDiagramIndicator();
			this._marker.remove();
		}
	});

	// TODO: maybe should i listen for this inside chart.js?
	this.on("elechart_updated elechart_init", function() {

		// Get legend items
		let items  = this._chart._legend.selectAll('.legend-item');

		// Calculate legend item positions
		let n      = items.nodes().length;
		let v      = Array(Math.floor(n / 2)).fill(null).map((d, i) => (i + 1) * 2 - (1 - Math.sign(n % 2)));
		let rev    = v.slice().reverse().map((d) => -(d));

		if (n % 2 !== 0) {
			rev.push(0);
		}
		v = rev.concat(v);

		// Get chart margins
		let xAxesB  = this._chart._axis.selectAll('.x.axis.bottom').nodes().length;
		let marginB = 60 + (xAxesB * 2);
		let marginR = n * 30;

		// Adjust chart right margins
		if (n && this.options.margins.right != marginR) {
			this.options.margins.right  = marginR;
			this.redraw();
		}

		// Adjust chart bottom margins
		if(xAxesB && this.options.margins.bottom != marginB) {
			this.options.margins.bottom = marginB;
			this.redraw();
		}

		items
			.each((d, i, n) => {

				let target  = n[i];
				let legend  = d3.select(target);
				let name    = target.getAttribute('data-name');
				let optName = name.toLowerCase();
				let path    = this._chart._area.select('path[data-name="' + name + '"]');
				let node    = path.node();

				legend

				// Bind legend click togglers
				.on('click', () => this._fireEvt("elepath_toggle", { path: node, name: name, legend: target }))

				// Adjust legend item positions
				.attr("transform", "translate(" + v[i] * 55 + ", " + xAxesB * 2 + ")");

				// Set initial chart area state
				if (optName in this.options && this.options[optName] == 'disabled') {
					path.classed('leaflet-hidden', true);
					legend.select('text').style('text-decoration-line', 'line-through');
					legend.select('rect').style('fill-opacity', '0');
				}

				// Apply d3-zoom (bind <clipPath> mask)
				if (this._chart._clipPath) {
					path.attr('clip-path', 'url(#' + this._chart._clipPath.attr('id') + ')');
				}

			});

		// Adjust axis scale positions
		this._chart._axis
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

	});

	this.on("eletrack_download", function(e) {
		if (e.downloadLink == 'modal' && typeof CustomEvent === "function") {
			document.dispatchEvent(new CustomEvent("eletrack_download", { detail: e }));
		} else if (e.downloadLink == 'link' || e.downloadLink === true) {
			e.confirm();
		}
	});

	this.on('eledata_loaded', function(e) {
		let map   = this._map;
		let layer = e.layer;
		if (!map) {
			console.warn("Undefined elevation map object");
			return;
		}
		map.once('layeradd',   (e) => this.options.autofitBounds && this.fitBounds(layer.getBounds()));

		if (this.options.polyline) layer.addTo(map);

		// Download "Leaflet-GeometryUtil" and "Leaflet-AlmostOver" scripts
		if (!L.Browser.mobile) {
			Elevation._geomutilLazyLoader = _.lazyLoader(
				this.__LGEOMUTIL,
				typeof L.GeometryUtil !== 'function' || !this.options.lazyLoadJS,
				Elevation._geomutilLazyLoader
			).then(
				() => {
					Elevation._almostoverLazyLoader = _.lazyLoader(
						this.__LALMOSTOVER,
						typeof L.Handler.AlmostOver  !== 'function' || !this.options.lazyLoadJS,
						Elevation._almostoverLazyLoader
					).then(
						() => {
							map.addHandler('almostOver',L.Handler.AlmostOver)
							// Support for "Leaflet.AlmostOver"
							if (L.GeometryUtil && map.almostOver && map.almostOver.enabled()) {
								map.almostOver.addLayer(layer);
								map
									.on('almost:move', (e) => this._mousemoveLayerHandler(e))
									.on('almost:out',  (e) => this._mouseoutHandler(e));
							}
						}
					);
				}
			);
		}
	});

	// Basic canvas renderer support.
	let oldProto = L.Canvas.prototype._fillStroke;
	let control  = this;
	L.Canvas.include({
		_fillStroke: function(ctx, layer) {
			if (control._layers.hasLayer(layer)) {
				let theme   = control.options.theme.replace('-theme', '');
				let colors  = L.extend({}, {
					'lightblue': '#3366CC',
					'magenta'  : '#FF005E',
					'red'      : '#F00',
					'yellow'   : '#FF0',
					'purple'   : '#732C7B',
					'steelblue': '#4682B4',
					'lime'     : '#566B13'
				}, control.options.colors);

				let options    = layer.options;
				options.color  = colors[theme] || theme;
				options.stroke = !!options.color;

				oldProto.call(this, ctx, layer);

				if (options.stroke && options.weight !== 0) {
					let oldVal                   = ctx.globalCompositeOperation || 'source-over';
					ctx.globalCompositeOperation = 'destination-over'
					ctx.strokeStyle              = '#FFF';
					ctx.lineWidth                = options.weight * 1.75;
					ctx.stroke();
					ctx.globalCompositeOperation = oldVal;
				}

			} else {
				oldProto.call(this, ctx, layer);
			}
		}
	});

	// Partially fix: https://github.com/Raruto/leaflet-elevation/issues/81#issuecomment-713477050
	this.on('elechart_init', function() {
		this.once('elechart_change elechart_hover', function(e) {
			if (this._chartEnabled) this._chart._showDiagramIndicator(e.data, e.xCoord);
			this._updateMarker(e.data);
		});
	});

});
