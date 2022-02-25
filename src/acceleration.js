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
			name       : 'acceleration'
		});

		this._registerAreaPath({
			name       : 'acceleration',
			label      : 'Acceleration',
			yAttr      : 'acceleration',
			scaleX     : 'distance',
			scaleY     : 'acceleration',
			color      : '#050402',
			strokeColor  : '#000',
			strokeOpacity: "0.5",
			fillOpacity  : "0.25",
		});

	}

	this.on('elepoint_added', function(e) {
		let data   = this._data;
		let i      = e.index;

		let currT  = data[i].time;
		let prevT  = i > 0 ? data[i - 1].time : currT;

		let deltaT = (currT - prevT) / 1000;

		let track  = this.track_info;
		let sMax   = track.acceleration_max || -Infinity; // Acceleration Max
		let sMin   = track.acceleration_min || +Infinity; // Acceleration Min
		let sAvg   = track.acceleration_avg || 0; // Acceleration Avg
		let acceleration = 0;

		if (deltaT > 0) {
			let curr     = data[i].speed;
			let prev     = i > 0 ? data[i - 1].speed : curr;
			let delta    = (curr - prev) * (1000 / opts.timeFactor);
			acceleration = Math.abs((delta / deltaT)) * opts.accelerationFactor;
		}

		// Try to smooth "crazy" acceleration values.
		if (this.options.accelerationDeltaMax) {
			let deltaA     = i > 0 ? acceleration - data[i - 1].acceleration : 0;
			let maxDeltaS  = this.options.accelerationDeltaMax;
			if (Math.abs(deltaA) > maxDeltaS) {
				acceleration = data[i - 1].acceleration + maxDeltaS * Math.sign(deltaA);
			}
		}

		// Range of acceptable acceleration values.
		acceleration = _.clamp(acceleration, this.options.accelerationRange);

		track.acceleration_max = acceleration > sMax ? acceleration : sMax;
		track.acceleration_min = acceleration < sMin ? acceleration : sMin;
		track.acceleration_avg = (acceleration + sAvg) / 2.0;

		data[i].acceleration = L.Util.formatNum(acceleration, 2);
	});

	this._registerTooltip({
		name  : 'acceleration',
		chart: (item) => L._("a: ") + item.acceleration + " " + acceleration.label,
		marker: (item) => Math.round(item.acceleration) + " " + acceleration.label,
	});

	this._registerSummary({
		"minacceleration"  : {
			label: "Min Acceleration: ",
			value: (track) => Math.round(track.acceleration_min || 0) + '&nbsp;' + acceleration.label
		},
		"maxacceleration"  : {
			label: "Max Acceleration: ",
			value: (track) => Math.round(track.acceleration_max || 0) + '&nbsp;' + acceleration.label
		},
		"avgacceleration": {
			label: "Avg Acceleration: ",
			value: (track) => Math.round(track.acceleration_avg || 0) + '&nbsp;' + acceleration.label
		}
	});

});
