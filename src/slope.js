import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.slope) return;

	let opts  = this.options;
	let slope = {};

	slope.label          = opts.slopeLabel || '%';

	this._registerDataAttribute({
		name: 'slope',
		// init: () => {
		// 	// this.track_info.ascent    = 0;         // Total Ascent
		// 	// this.track_info.descent   = 0;         // Total Descent
		// 	// this.track_info.slope_max = -Infinity; // Slope Max
		// 	// this.track_info.slope_min = +Infinity; // Slope Min
		// 	// this.track_info.slope_avg = 0;         // Acceleration Avg
		// },
		fetch: (i) => {
			let data  = this._data;
			let dx    = (data[i].dist - data[i > 0 ? i - 1 : i].dist) * 1000;
			let dz    = data[i].z - data[i > 0 ? i - 1 : i].z;
			return (!isNaN(dz) && dx !== 0) ? (dz / dx) * 100 : 0; // slope in % = ( height / length ) * 100;
		},
		update: (slope, i) => {
			this.track_info.ascent    = this.track_info.ascent    || 0;         // Total Ascent
			this.track_info.descent   = this.track_info.descent   || 0;         // Total Descent
			this.track_info.slope_max = this.track_info.slope_max || -Infinity; // Slope Max
			this.track_info.slope_min = this.track_info.slope_min || +Infinity; // Slope Min
			this.track_info.slope_avg = this.track_info.slope_avg || 0;         // Acceleration Avg

			let track = this.track_info;
			let data  = this._data;
			let dz    = data[i].z - data[i > 0 ? i - 1 : i].z;

			// Try to smooth "crazy" acceleration values.
			if (this.options.slopeDeltaMax) {
				let delta    = slop - data[i > 0 ? i - 1 : i].slope;
				let deltaMax = this.options.slopeDeltaMax;
				if (Math.abs(delta) > deltaMax) {
					slope = data[i - 1].slope + deltaMax * Math.sign(delta);
				}
			}

			// Range of acceptable slope values.
			slope = _.clamp(slope, this.options.slopeRange);

			if (dz > 0)      this.track_info.ascent += dz;
			else if (dz < 0) this.track_info.descent -= dz;

			if (slope > track.slope_max) track.slope_max = slope;
			if (slope < track.slope_min) track.slope_min = slope;

			track.slope_avg = (slope + track.slope_avg) / 2.0;

			return L.Util.formatNum(slope, 2);;
		}
	});

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
		name       : 'slope',
		visbile    : this.options.slope != "summary"
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
		visbile      : this.options.slope != "summary"
	});

	this._registerTooltip({
		name: 'slope',
		chart: (item) => L._("m: ") + item.slope + slope.label,
		marker: (item) => Math.round(item.slope) + slope.label,
		order: 40,
	});

	this._registerSummary({
		"ascent"  : {
			label: "Total Ascent: ",
			value: (track) => Math.round(track.ascent || 0) + '&nbsp;' + (this.options.imperial ? 'ft' : 'm'),
			order: 40
		},
		"descent"  : {
			label: "Total Descent: ",
			value: (track) => Math.round(track.descent || 0) + '&nbsp;' + (this.options.imperial ? 'ft' : 'm'),
			order: 40
		},
		"minslope": {
			label: "Min Slope: ",
			value: (track) => Math.round(track.slope_min || 0) + '&nbsp;' + slope.label,
			order: 40
		},
		"maxslope": {
			label: "Max Slope: ",
			value: (track) => Math.round(track.slope_max || 0) + '&nbsp;' + slope.label,
			order: 40
		},
		"avgslope": {
			label: "Avg Slope: ",
			value: (track) => Math.round(track.slope_avg || 0) + '&nbsp;' + slope.label,
			order: 40
		}
	});


});
