import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.slope) return;

	let opts  = this.options;
	let slope = {};

	slope.label          = opts.slopeLabel || '%';

	if (this.options.slope != "summary") {

		this._registerAxisScale({
			axis       : "y",
			position   : "right",
			scale      : {
				min        : -1,
				max        : +1,
			},
			tickPadding: 16,
			label      : slope.label,
			labelX     : 25,
			labelY     : -8,
			name       : 'slope'
		});

		this._registerAreaPath({
			name         : 'slope',
			label        : 'Slope',
			yAttr        : 'slope',
			scaleX       : 'distance',
			scaleY       : 'slope',
			color        : '#F00',
			strokeColor  : '#000',
			strokeOpacity: "0.5",
			fillOpacity  : "0.25",
		});

	}

	this.on("eledata_updated", function(e) {
		let data  = this._data;
		let i     = e.index;
		let z     = data[i].z;
		let delta = (data[i].dist - data[i > 0 ? i - 1 : i].dist) * 1000;

		// Slope / Gain
		let track = this.track_info;
		let tAsc  = track.ascent    || 0; // Total Ascent
		let tDes  = track.descent   || 0; // Total Descent
		let sMax  = track.slope_max || 0; // Slope Max
		let sMin  = track.slope_min || 0; // Slope Min
		let slope = 0;

		if (!isNaN(z)) {
			let deltaZ  = i > 0 ? z - data[i - 1].z : 0;
			if (deltaZ > 0)      tAsc += deltaZ;
			else if (deltaZ < 0) tDes -= deltaZ;
			// slope in % = ( height / length ) * 100
			if (delta !== 0)     slope = (deltaZ / delta) * 100;
		}

		// Try to smooth "crazy" slope values.
		if (this.options.sDeltaMax) {
			let deltaS    = i > 0 ? slope - data[i - 1].slope : 0;
			let maxDeltaS = this.options.sDeltaMax;
			if (Math.abs(deltaS) > maxDeltaS) {
				slope       = data[i - 1].slope + maxDeltaS * Math.sign(deltaS);
			}
		}

		// Range of acceptable slope values.
		if (this.options.sRange) {
			let range = this.options.sRange;
			if (slope < range[0])      slope = range[0];
			else if (slope > range[1]) slope = range[1];
		}

		slope = L.Util.formatNum(slope, 2);

		if (slope > sMax) sMax = slope;
		if (slope < sMin) sMin = slope;

		data[i].slope   = slope;

		track.ascent    = tAsc;
		track.descent   = tDes;
		track.slope_max = sMax;
		track.slope_min = sMin;
	});

	this._registerFocusLabel({
		name: 'slope',
		chart: (item) => item.slope + slope.label,
		marker: (item) => Math.round(item.slope) + slope.label
	});

	this._registerSummary({
		"ascent"  : {
			label: "Total Ascent: ",
			value: (track) => Math.round(track.ascent || 0) + '&nbsp;' + this._yLabel
		},
		"descent"  : {
			label: "Total Descent: ",
			value: (track) => Math.round(track.descent || 0) + '&nbsp;' + this._yLabel
		},
		"minslope": {
			label: "Min Slope: ",
			value: (track) => Math.round(track.slope_min || 0) + '&nbsp;' + slope.label
		},
		"maxslope": {
			label: "Max Slope: ",
			value: (track) => Math.round(track.slope_max || 0) + '&nbsp;' + slope.label
		}
	});


});
