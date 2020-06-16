import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';

export var Marker = L.Class.extend({

	initialize: function(options) {
		this.options = options;

		if (this.options.imperial) {
			// this._distanceFactor = this.__mileFactor;
			// this._heightFactor = this.__footFactor;
			this._xLabel = "mi";
			this._yLabel = "ft";
		} else {
			// this._distanceFactor = this.options.distanceFactor;
			// this._heightFactor = this.options.heightFactor;
			this._xLabel = this.options.xLabel;
			this._yLabel = this.options.yLabel;
		}

		if (this.options.marker == 'elevation-line') {
			let g = this._heightG = d3.create("g").attr("class", "height-focus-group");
			this._mouseHeightFocus = d3.create('svg:line');
			this._pointG = d3.create("svg:circle");
			this._mouseHeightFocusLabel = d3.create("svg:text");
		} else if (this.options.marker == 'position-marker') {
			this._marker = L.marker([0, 0], { icon: this.options.markerIcon, zIndexOffset: 1000000, interactive: false });
		}
		return this;
	},

	addTo: function(map) {
		this._map = map;
		let pane, renderer;
		if (!map.getPane('elevationPane')) {
			pane = this._pane = map.createPane('elevationPane');
			pane.style.zIndex = 625; // This pane is above markers but below popups.
			pane.style.pointerEvents = 'none';
		}
		if (this.options.marker == 'elevation-line') {
			renderer = L.svg({ pane: "elevationPane" }).addTo(this._map); // default leaflet svg renderer
			let g = this._heightG = d3.select(renderer.getPane()).select("svg > g").attr("class", "height-focus-group");
			g.append(() => this._mouseHeightFocus.node());
			g.append(() => this._pointG.node());
			g.append(() => this._mouseHeightFocusLabel.node());
		} else if (this.options.marker == 'position-marker') {
			this._marker.addTo(map, { pane: 'elevationPane' });
		}
		return this;
	},

	/**
	 * Update position marker ("leaflet-marker").
	 */
	update: function(props) {
		if (props.options) this.options = props.options;

		let opts = this.options;

		if (!this._map) this.addTo(props.map);

		this._latlng = props.item.latlng;

		let point = L.extend({}, props.item, this._map.latLngToLayerPoint(this._latlng));

		if (this.options.marker == 'elevation-line') {

			let formatter = opts.hoverNumber.formatter;
			let fy = opts.hoverNumber.decimalsY;

			let normalizedAlt = this._height() / props.maxElevation * point.z;
			let normalizedY = point.y - normalizedAlt;

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
		} else if (this.options.marker == 'position-marker') {
			_.removeClass(this._marker.getElement(), 'hidden');
			this._marker.setLatLng(this._latlng);
		}
	},

	/*
	 * Hides the position/height indicator marker drawn onto the map
	 */
	remove: function() {
		if (this.options.marker == 'elevation-line') {
			if (this._heightG) this._heightG.classed("hidden", true);
			if (this._pointG) this._pointG.classed("hidden", true);
		} else if (this.options.marker == 'position-marker') {
			_.addClass(this._marker.getElement(), 'hidden');
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

});
