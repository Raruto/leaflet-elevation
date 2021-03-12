import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.slope) return;

	let opts  = this.options;
	let slope = {};

	if (this.options.slope != "summary") {

		this.on("elechart_axis", function() {
			slope.x = this._chart._x;
			slope.y = this._chart._registerAxisScale({
				axis       : "y",
				position   : "right",
				scale      : {
					range      : [this._height(), 0],
					attr       : "slope",
					min        : -1,
					max        : +1,
				},
				ticks      : this.options.yTicks,
				tickPadding: 16,
				label      : '%',
				labelX     : 25,
				labelY     : -8,
				name       : 'slope'
			});
		});

		this.on("elechart_init", function() {

			this._chart._registerAreaPath({
				name         : 'slope',
				label        : 'Slope',
				xAttr        : opts.xAttr,
				yAttr        : 'slope',
				scaleX       : slope.x,
				scaleY       : slope.y,
				color        : '#F00',
				strokeColor  : '#000',
				strokeOpacity: "0.5",
				fillOpacity  : "0.25",
			});

		});

	}

	this.on("eledata_updated", function(e) {
		let data  = this._data;
		let i     = e.index;
		let z     = data[i].z;
		let delta = (data[i].dist - data[i > 0 ? i - 1 : i].dist) * 1000;

		// Slope / Gain
		let tAsc  = this._tAsc || 0; // Total Ascent
		let tDes  = this._tDes || 0; // Total Descent
		let sMax  = this._sMax || 0; // Slope Max
		let sMin  = this._sMin || 0; // Slope Min
		let slope = 0;

		if (!isNaN(z)) {
			let deltaZ = i > 0 ? z - data[i - 1].z : 0;
			if (deltaZ > 0) tAsc += deltaZ;
			else if (deltaZ < 0) tDes -= deltaZ;
			// slope in % = ( height / length ) * 100
			slope = delta !== 0 ? (deltaZ / delta) * 100 : 0;
		}

		// Try to smooth "crazy" slope values.
		if (this.options.sDeltaMax) {
			let deltaS    = i > 0 ? slope - data[i - 1].slope : 0;
			let maxDeltaS = this.options.sDeltaMax;
			if (Math.abs(deltaS) > maxDeltaS) {
				slope = data[i - 1].slope + maxDeltaS * Math.sign(deltaS);
			}
		}

		// Range of acceptable slope values.
		if (this.options.sRange) {
			let range = this.options.sRange;
			if (slope < range[0]) slope = range[0];
			else if (slope > range[1]) slope = range[1];
		}

		slope = L.Util.formatNum(slope, 2);

		sMax = slope > sMax ? slope : sMax;
		sMin = slope < sMin ? slope : sMin;

		data[i].slope = slope;

		this.track_info.ascent    = this._tAsc = tAsc;
		this.track_info.descent   = this._tDes = tDes;
		this.track_info.slope_max = this._sMax = sMax;
		this.track_info.slope_min = this._sMin = sMin;
	});

	this.on("elechart_change", function(e) {
		let item = e.data;

		this._chart._registerFocusLabel({
			name: 'slope',
			value: item.slope + "%"
		});

		this._marker._registerFocusLabel({
			name: 'slope',
			value: Math.round(item.slope) + "%"
		});

	});

	this.on("elechart_summary", function() {

		this.track_info.ascent    = this._tAsc || 0;
		this.track_info.descent   = this._tDes || 0;
		this.track_info.slope_max = this._sMax || 0;
		this.track_info.slope_min = this._sMin || 0;

		this._summary._registerSummary({
			"ascent"  : {
				label: "Total Ascent: ",
				value: Math.round(this.track_info.ascent) + '&nbsp;' + this._yLabel
			},
			"descent"  : {
				label: "Total Descent: ",
				value: Math.round(this.track_info.descent) + '&nbsp;' + this._yLabel
			},
			"minslope": {
				label: "Min Slope: ",
				value: Math.round(this.track_info.slope_min) + '&nbsp;' + '%'
			},
			"maxslope": {
				label: "Max Slope: ",
				value: Math.round(this.track_info.slope_max) + '&nbsp;' + '%'
			}
		});

	});

	this.on("eledata_clear", function() {
		this._sMax = null;
		this._sMin = null;
		this._tAsc = null;
		this._tDes = null;
	});

});
