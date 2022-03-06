import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.acceleration) return;

	let opts = this.options;
	let acceleration = {};

	acceleration.label      = opts.accelerationLabel  || L._(opts.imperial ? 'ft/s²' : 'm/s²');
	opts.accelerationFactor = opts.accelerationFactor || 1;

	this._registerDataAttribute({
		name: 'acceleration',
		init: () => {
			// this.track_info.acceleration_max = -Infinity; // Acceleration Max
			// this.track_info.acceleration_min = +Infinity; // Acceleration Min
			// this.track_info.acceleration_avg = 0;         // Acceleration Avg
		},
		fetch: (i) => {
			let data   = this._data;
			let dv     = (data[i].speed - data[i > 0 ? i - 1 : i].speed) * (1000 / opts.timeFactor);
			let dt     = (data[i].time - data[i > 0 ? i - 1 : i].time) / 1000;
			return dt > 0 ? Math.abs((dv / dt)) * opts.accelerationFactor : 0;
		},
		update: (acceleration, i) => {
			this.track_info.acceleration_max = this.track_info.acceleration_max || -Infinity; // Acceleration Max
			this.track_info.acceleration_min = this.track_info.acceleration_min || +Infinity; // Acceleration Min
			this.track_info.acceleration_avg = this.track_info.acceleration_avg || 0;         // Acceleration Avg

			let data  = this._data;
			let track = this.track_info;

			// Try to smooth "crazy" acceleration values.
			if (this.options.accelerationDeltaMax) {
				let delta    = acceleration - data[i > 0 ? i - 1 : i].acceleration;
				let deltaMax = this.options.accelerationDeltaMax;
				if (Math.abs(delta) > deltaMax) {
					acceleration = data[i - 1].acceleration + deltaMax * Math.sign(delta);
				}
			}

			// Range of acceptable acceleration values.
			acceleration = _.clamp(acceleration, this.options.accelerationRange);
	
			if (acceleration > track.acceleration_max) track.acceleration_max = acceleration;
			if (acceleration < track.acceleration_min) track.acceleration_min = acceleration;

			track.acceleration_avg = (acceleration + track.acceleration_avg) / 2.0;

			return L.Util.formatNum(acceleration, 2);
		},
	});

	if (this.options.acceleration != "summary") {

		this._registerAxisScale({
			axis       : "y",
			position   : "right",
			scale      : {
				min        : 0,
				max        : +1,
			},
			tickPadding: 16,
			label      : acceleration.label,
			labelX     : 25,
			labelY     : -8,
			name       : 'acceleration',
		});

		this._registerAreaPath({
			name         : 'acceleration',
			label        : 'Acceleration',
			yAttr        : 'acceleration',
			scaleX       : 'distance',
			scaleY       : 'acceleration',
			color        : '#050402',
			strokeColor  : '#000',
			strokeOpacity: "0.5",
			fillOpacity  : "0.25",
		});

	}

	this._registerTooltip({
		name  : 'acceleration',
		chart: (item) => L._("a: ") + item.acceleration + " " + acceleration.label,
		marker: (item) => Math.round(item.acceleration) + " " + acceleration.label,
		order: 60,
	});

	this._registerSummary({
		"minacceleration"  : {
			label: "Min Acceleration: ",
			value: (track) => Math.round(track.acceleration_min || 0) + '&nbsp;' + acceleration.label,
			order: 60
		},
		"maxacceleration"  : {
			label: "Max Acceleration: ",
			value: (track) => Math.round(track.acceleration_max || 0) + '&nbsp;' + acceleration.label,
			order: 60
		},
		"avgacceleration": {
			label: "Avg Acceleration: ",
			value: (track) => Math.round(track.acceleration_avg || 0) + '&nbsp;' + acceleration.label,
			order: 60
		}
	});

});
