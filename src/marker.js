import 'leaflet-i18n';
import * as _  from './utils';
import * as D3 from './components';

export var Marker = L.Class.extend({

	initialize: function(options) {
		this.options = options;

		if (this.options.imperial) {
			this._xLabel = "mi";
			this._yLabel = "ft";
		} else {
			this._xLabel = this.options.xLabel;
			this._yLabel = this.options.yLabel;
		}

		if (this.options.marker == 'elevation-line') {
			// this._container = d3.create("g").attr("class", "height-focus-group");
			this._focusline   = d3.create('svg:line');
			this._focusmarker = d3.create("svg:circle");
			this._focuslabel  = d3.create("svg:text");
		} else if (this.options.marker == 'position-marker') {
			// this._marker   = L.circleMarker([0, 0], { pane: 'overlayPane', radius: 6, fillColor: '#fff', fillOpacity:1, color: '#000', weight:1, interactive: false });
			this._marker      = L.marker([0, 0], { icon: this.options.markerIcon, zIndexOffset: 1000000, interactive: false });
		}

		this._focuslabels = {};

		return this;
	},

	addTo: function(map) {
		this._map = map;
		if (this.options.marker == 'elevation-line') {
			let g = this._container = d3.select(map.getPane('elevationPane')).select("svg > g")
				.attr("class", "height-focus-group");
			g.append(() => this._focusline.node());
			g.append(() => this._focusmarker.node());
			g.append(() => this._focuslabel.node());
		} else if (this.options.marker == 'position-marker') {
			this._marker.addTo(map, { pane: 'overlayPane' });
		}
		return this;
	},

	/**
	 * Update position marker ("leaflet-marker").
	 */
	update: function(props) {
		if (props) this._props = props;
		else props = this._props;

		if(!props) return;

		if (props.options) this.options = props.options;
		if (!this._map) this.addTo(props.map);

		let opts = this.options;
		let map = this._map;

		this._latlng = props.item.latlng;

		let pos = map.latLngToLayerPoint(this._latlng);

		if (map._rotate) {
			pos = map.rotatedPointToMapPanePoint(pos);
		}

		let point = L.extend({}, props.item, pos);

		if (this.options.marker == 'elevation-line') {

			let normalizedAlt = this._height() / props.maxElevation * point.z;
			let normalizedY   = point.y - normalizedAlt;

			this._container.classed("leaflet-hidden", false);

			this._focusmarker
				.call(
					D3.HeightFocusMarker({
						theme : opts.theme,
						xCoord: point.x,
						yCoord: point.y,
					}));

			this._focusline
				.call(
					D3.HeightFocusLine({
						theme : opts.theme,
						xCoord: point.x,
						yCoord: point.y,
						length: normalizedY
					})
				);
			this._focuslabel
				.call(
					D3.HeightFocusLabel({
						theme : opts.theme,
						xCoord: point.x,
						yCoord: normalizedY,
						label : d3.format("." + opts.decimalsY + "f")(point[opts.yAttr]) + " " + this._yLabel
					})
				);

			let labels = this._focuslabels;
			let tooltip = this._focuslabel;
			let label;

			for (var i in labels) {
				label = tooltip.select(".height-focus-" + labels[i].name);

				if (!label.size()) {
					label   = tooltip.append("svg:tspan")
						.attr("class", "height-focus-" + labels[i].name)
						.attr("dy", "1.5em");
				}

				label.text(typeof labels[i].value !== "function" ? labels[i].value : labels[i].value(props.item) );

				this._focuslabel.select('.height-focus-y')
					.attr("dy", "-1.5em");
			}

		} else if (this.options.marker == 'position-marker') {
			_.removeClass(this._marker.getElement(), 'leaflet-hidden');
			this._marker.setLatLng(this._latlng);
		}
	},

	/*
	 * Hides the position/height indicator marker drawn onto the map
	 */
	remove: function() {
		this._props = null;
		if (this.options.marker == 'elevation-line') {
			if (this._container) this._container.classed("leaflet-hidden", true);
		} else if (this.options.marker == 'position-marker') {
			_.addClass(this._marker.getElement(), 'leaflet-hidden');
		}
	},

	getLatLng: function() {
		return this._latlng;
	},

	/**
	 * Calculates chart height.
	 */
	_height: function() {
		let opts = this.options;
		return opts.height - opts.margins.top - opts.margins.bottom;
	},

	_registerFocusLabel: function(props) {
		this._focuslabels[props.name] = props;
	}

});
