import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Chart } from './chart';
import { Marker } from './marker';
import { Summary } from './summary';
import { Options } from './options';

export const Elevation = L.Control.Elevation = L.Control.extend({

	includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

	options: Options,
	__mileFactor: 0.621371,
	__footFactor: 3.28084,
	__D3: 'https://unpkg.com/d3@5.15.0/dist/d3.min.js',
	__LGPX: 'https://unpkg.com/leaflet-gpx@1.5.0/gpx.js',

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
			if (!eleDiv.isConnected) _.insert(map._container, eleDiv, 'afterend');
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
		this._marker.remove();
		this._chart._resetDrag();
		this._layers.eachLayer(l => _.removeClass(l._path, this.options.polyline.className + ' ' + this.options.theme));

		this._data = null;
		this._distance = null;
		this.track_info = null;
		this._layers = null;

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
		this._zFollow = this.options.zFollow;

		if (this.options.followMarker) this._setMapView = L.Util.throttle(this._setMapView, 300, this);
		if (this.options.placeholder) this.options.loadData.lazy = this.options.loadData.defer = true;

		if (this.options.legend) this.options.margins.bottom += 30;
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
			this.__LGPX,
			typeof L.GPX !== 'function' || !this.options.lazyLoadJS,
			Elevation._gpxLazyLoader
		).then(() => _.GPXLoader(data, this));
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

		let container = this._container = _.create("div", "elevation-control elevation " + this.options.theme);

		if (!this.options.detached) {
			_.addClass(container, 'leaflet-control');
		}

		if (this.options.placeholder && !this._data) {
			this.placeholder = _.create('img', 'elevation-placeholder', typeof this.options.placeholder === 'string' ? { src: this.options.placeholder, alt: '' } : this.options.placeholder);
			_.insert(container, this.placeholder, 'beforebegin');
		}

		Elevation._d3LazyLoader = _.lazyLoader(
			this.__D3,
			typeof d3 !== 'object' || !this.options.lazyLoadJS,
			Elevation._d3LazyLoader
		).then(() => {
			this._initToggle(container);
			this._initChart(container);
			this._initMarker(container);

			map.on('zoom viewreset zoomanim', this._hideMarker, this);
			map.on('resize', this._resetView, this);
			map.on('resize', this._resizeChart, this);
			map.on('mousedown', this._resetDrag, this);

			_.on(map._container, 'mousewheel', this._resetDrag, this);
			_.on(map._container, 'touchstart', this._resetDrag, this);

			this.on('eledata_added eledata_loaded', this._updateChart, this);
			this.on('eledata_added eledata_loaded', this._updateSummary, this);

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

		map.off('zoom viewreset zoomanim', this._hideMarker, this);
		map.off('resize', this._resetView, this);
		map.off('resize', this._resizeChart, this);
		map.off('mousedown', this._resetDrag, this);

		_.off(map._container, 'mousewheel', this._resetDrag, this);
		_.off(map._container, 'touchstart', this._resetDrag, this);

		this.off('eledata_added eledata_loaded', this._updateChart, this);
		this.off('eledata_added eledata_loaded', this._updateSummary, this);
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
		let geom = d && d.geometry;
		let feat = d && d.type === "FeatureCollection";
		let gpx = d && d._latlngs;

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

		if (feat) {
			_.each(d.features, feature => this._addData(feature));
		}

		if (gpx) {
			this._addGPXData(d._latlngs);
		}
	},

	/*
	 * Parsing of GeoJSON data lines and their elevation in z-coordinate
	 */
	_addGeoJSONData: function(coords) {
		_.each(coords, point => this._addPoint(point[1], point[0], point[2]));
	},

	/*
	 * Parsing function for GPX data and their elevation in z-coordinate
	 */
	_addGPXData: function(coords) {
		_.each(coords, point => this._addPoint(point.lat, point.lng, point.meta.ele));
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

		this._fireEvt("eledata_updated", { index: data.length - 1 });
	},

	_addLayer: function(layer) {
		if (layer) {
			_.addClass(layer._path, this.options.polyline.className + ' ' + this.options.theme);

			layer
				.on("mousemove", this._mousemoveLayerHandler, this)
				.on("mouseout", this._mouseoutHandler, this);

			this._layers = this._layers || L.layerGroup();
			this._layers.addLayer(layer)
		}
	},

	/**
	 * Adds the control to the given "detached" div.
	 */
	_initElevationDiv: function() {
		let eleDiv = _.select(this.options.elevationDiv);
		if (!eleDiv) {
			this.options.elevationDiv = '#elevation-div_' + _.randomId();
			eleDiv = _.create('div', 'leaflet-control elevation elevation-div', { id: this.options.elevationDiv.substr(1) });
		}
		if (this.options.detached) {
			_.addClass(eleDiv, 'elevation-detached');
			_.removeClass(eleDiv, 'leaflet-control');
		}
		this.eleDiv = eleDiv;
		return this.eleDiv;
	},

	/*
	 * Collapse current chart control.
	 */
	_collapse: function() {
		_.removeClass(this._container, 'elevation-expanded');
		_.addClass(this._container, 'elevation-collapsed');
	},

	/*
	 * Expand current chart control.
	 */
	_expand: function() {
		_.removeClass(this._container, 'elevation-collapsed');
		_.addClass(this._container, 'elevation-expanded');
	},

	/*
	 * Finds an item with the smallest delta in distance to the given latlng coords
	 */
	_findItemForLatLng: function(latlng) {
		let result = null;
		let d = Infinity;
		_.each(this._data,
			item => {
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
		return this._chart._findItemForX(x);
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
	_initChart: function() {
		let opts = this.options;
		opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
		opts.yTicks = opts.yTicks || Math.round(this._height() / 30);

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

		let chart = this._chart = new Chart(opts);
		let summary = this._summary = new Summary(opts);

		let container = d3.select(this._container)
			.call(chart.render())
			.call(summary.render());

		this._svg = chart._svg;
		this._grid = chart._grid;
		this._area = chart._area;
		this._path = chart._path;
		this._axis = chart._axis;
		this._focus = chart._focus;
		this._focusRect = chart._focusRect;
		this._x = chart._x;
		this._y = chart._y;
		this._legend = chart._legend;
		this._focuslabel = chart._focuslabel;
		this._focusline = chart._focusline;
		this.summaryDiv = summary._summary;

		chart.on('reset_drag', this._hideMarker, this);
		chart.on('mouse_enter', this._fireEvt.bind('elechart_enter'), this);
		chart.on('dragged', this._fireEvt.bind("elechart_dragged"), this);
		chart.on('mouse_move', this._mousemoveHandler, this);
		chart.on('mouse_out', this._mouseoutHandler, this);
		// chart.on('legend', this._fireEvt.bind('elechart_legend'), this);

		this._fireEvt("elechart_init");
	},

	_initMarker: function(container) {
		this._marker = (new Marker(this.options)).addTo(this._map);

		this._mouseHeightFocusLabel = this._marker._mouseHeightFocusLabel;
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
			_.on(container, 'click', L.DomEvent.stopPropagation);
		}

		_.on(container, 'mousewheel', this._mousewheelHandler, this);

		if (!this.options.detached) {
			let link = this._button = _.create('a', "elevation-toggle elevation-toggle-icon" + (this.options.autohide ? "" : " close-button"), { href: '#', title: L._('Elevation') }, container);

			if (this.options.collapsed) {
				this._collapse();
				if (this.options.autohide) {
					_.on(container, 'mouseover', this._expand, this);
					_.on(container, 'mouseout', this._collapse, this);
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

	/*
	 * Handles the moueseover the chart and displays distance and altitude level.
	 */
	_mousemoveHandler: function(e) {
		if (!this._data || this._data.length === 0 || !this._chartEnabled) {
			return;
		}
		let xCoord = e.xCoord;
		let item = this._data[this._findItemForX(xCoord)];

		this._updateMarker(item);
		this._setMapView(item);

		if (this._map) {
			_.addClass(this._map._container, 'elechart-hover');
		}

		this._fireEvt("elechart_change", { data: item, xCoord: xCoord });
		this._fireEvt("elechart_hover", { data: item, xCoord: xCoord });
	},

	/*
	 * Handles mouseover events of the data layers on the map.
	 */
	_mousemoveLayerHandler: function(e) {
		if (!this._data || this._data.length === 0) {
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
			_.removeClass(this._map._container, 'elechart-hover');
		}

		this._fireEvt("elechart_leave");
	},

	/*
	 * Handles the mouesewheel over the chart.
	 */
	_mousewheelHandler: function(e) {
		if (this._map.gestureHandling && this._map.gestureHandling._enabled) return;
		let ll = this._marker.getLatLng() || this._map.getCenter();
		let z = this._map.getZoom() + Math.sign(e.deltaY);
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
		this.fitBounds();
	},

	/**
	 * Hacky way for handling chart resize. Deletes it and redraw chart.
	 */
	_resizeChart: function() {
		// prevent displaying chart on resize if hidden
		if (_.style(this._container, "display") == "none") return;

		if (this.options.responsive) {
			if (this.options.detached) {
				let newWidth = this.eleDiv.offsetWidth; // - 20;
				if (newWidth) {
					this.options.width = newWidth;
					this.eleDiv.innerHTML = "";
					_.append(this.eleDiv, this.onAdd(this._map));
				}
			} else {
				this._map.removeControl(this._container);
				this.addTo(this._map);
			}
		}
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
		zoom = zoom < this._zFollow ? this._zFollow : zoom;
		this._map.setView(item.latlng, zoom, { animate: true, duration: 0.25 });
	},

	/**
	 * Calculates [x, y] domain and then update chart.
	 */
	_updateChart: function() {
		if (!this._data || !this._container) return;

		this._chart = this._chart.update({ data: this._data });

		this._x = this._chart._x;
		this._y = this._chart._y;

		this._fireEvt("elechart_axis");
		if (this.options.legend) this._fireEvt("elechart_legend");

		this._fireEvt('elechart_updated');
	},

	/*
	 * Update the position/height indicator marker drawn onto the map
	 */
	_updateMarker: function(item) {
		this._marker.update({ item: item, maxElevation: this._maxElevation, options: this.options });
	},

	/**
	 * Update chart summary.
	 */
	_updateSummary: function() {
		this.track_info = this.track_info || {};
		this.track_info.distance = this._distance || 0;
		this.track_info.elevation_max = this._maxElevation || 0;
		this.track_info.elevation_min = this._minElevation || 0;

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
		if (pop._content) {
			pop._content = decodeURI(pop._content);
			p.bindTooltip(pop._content, { direction: 'top', sticky: true, opacity: 1, className: 'elevation-tooltip' }).openTooltip();
		}
	});

	this.on('elepath_toggle', function(e) {
		let path = e.path;

		let enabled = _.hasClass(path, 'hidden');
		let text = _.select('text', e.legend);

		if (enabled) {
			_.removeClass(path, 'hidden');
			_.style(text, "text-decoration-line", "")
		} else {
			_.addClass(path, 'hidden');
			_.style(text, "text-decoration-line", "line-through")
		}

		this._chartEnabled = this._area.selectAll('path:not(.hidden)').nodes().length != 0;

		// autotoggle chart data on single click
		if (!this._chartEnabled) {;
			this._resetDrag();
			// this._clearPath();
		} else {
			// this._resizeChart();
			this._layers.eachLayer(l => _.addClass(l._path, this.options.polyline.className + ' ' + this.options.theme));
		}
	});

	this.on("elechart_dragged", function(e) {
		this._hideMarker();
		this.fitBounds(L.latLngBounds([e.dragstart.latlng, e.dragend.latlng]));
	});

	this.on("elechart_updated", function() {
		// TODO: maybe should i listen for this inside chart.js?
		this._legend.selectAll('.legend-item')
			.on('click', (d, i, n) => {
				let target = n[i];
				let name = target.getAttribute('data-name');
				let path = this._area.select('path[data-name="' + name + '"]').node();
				this._fireEvt("elepath_toggle", { path: path, name: name, legend: target });
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
