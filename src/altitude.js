import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	let opts       = this.options;
	let altitude   = {};

	let theme      = opts.theme.replace('-theme', '');
	let color      = D3.Colors[theme] || {};

	if (opts.imperial) {
		opts.altitudeFactor = this.__footFactor;
		altitude.label      = "ft";
	} else {
		opts.altitudeFactor = opts.heightFactor || opts.altitudeFactor || 1;
		altitude.label      = opts.yLabel;
	}

	this._registerDataAttribute({
		name: 'z',
		skipNull: this.options.skipNullZCoords,
		init: ({point, }) => {
			// "alt" property is generated inside "leaflet"
			if ("alt" in point) point.meta.ele = point.alt;

			// this.track_info.elevation_max = -Infinity;
			// this.track_info.elevation_min = +Infinity;
			// this.track_info.elevation_avg = 0;
		},
		fetch: (i) => {
			return this._data[i].z * opts.altitudeFactor;
		},
		update: (z, i) => {
			this.track_info.elevation_max = this.track_info.elevation_max || -Infinity;
			this.track_info.elevation_min = this.track_info.elevation_max || +Infinity;
			this.track_info.elevation_avg = this.track_info.elevation_avg || 0;

			let data  = this._data;
			let track = this.track_info;

			// Try to smooth "crazy" elevation values.
			if (this.options.altitudeDeltaMax) {
				let delta    = z - data[i > 0 ? i - 1 : i].z;
				let deltaMax = this.options.altitudeDeltaMax;
				if (Math.abs(delta) > deltaMax) {
					z = data[i - 1].z + deltaMax * Math.sign(delta);
				}
			}

			// Range of acceptable elevation values.
			z = _.clamp(z, this.options.altitudeRange);

			if (z > track.elevation_max) track.elevation_max = z;
			if (z < track.elevation_min) track.elevation_min = z;

			track.elevation_avg = (z + track.elevation_avg) / 2.0;

			return z;
		}
	});

	this._registerAxisScale({
		axis    : "y",
		position: "left",
		scale   : "y", // this._chart._y,
		label   : altitude.label,
		labelX  : -3,
		labelY  : -8,
		name    : "altitude",
		visbile : this.options.altitude != "summary"
	});

	this._registerAxisGrid({
		axis      : "y",
		position  : "left",
		scale     : "y" // this._chart._y,
	});

	this._registerAreaPath({
		name         : 'altitude',
		label        : 'Altitude',
		scaleX       : 'distance',
		scaleY       : 'altitude',
		color        : color.area || theme,
		strokeColor  : opts.detached ? color.stroke : '#000',
		strokeOpacity: "1",
		fillOpacity  : opts.detached ? (color.alpha || '0.8') : 1,
		preferCanvas : opts.preferCanvas,
		visbile      : this.options.altitude != "summary"
	});

	this._registerTooltip({
		name: 'y',
		chart: (item) => L._("y: ") + d3.format("." + opts.decimalsY + "f")(item[opts.yAttr]) + " " + altitude.label,
		marker: (item) => d3.format("." + opts.decimalsY + "f")(item[opts.yAttr]) + " " + altitude.label,
		order: 10,
	});

	this._registerSummary({
		"maxele"  : {
			label: "Max Elevation: ",
			value: (track) => (track.elevation_max || 0).toFixed(2) + '&nbsp;' + altitude.label,
			order: 30,
		},
		"minele"  : {
			label: "Min Elevation: ",
			value: (track) => (track.elevation_min || 0).toFixed(2) + '&nbsp;' + altitude.label,
			order: 30,
		},
		"avgele"  : {
			label: "Avg Elevation: ",
			value: (track) => (track.elevation_avg || 0).toFixed(2) + '&nbsp;' + altitude.label,
			order: 30,
		},
	});
});