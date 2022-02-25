import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.speed && !this.options.acceleration) return;

	let opts = this.options;
	let speed = {};

	speed.label      = opts.speedLabel  || L._(opts.imperial ? 'mph' : 'km/h');
	opts.speedFactor = opts.speedFactor || 1;

	if (this.options.speed && this.options.speed != "summary") {

		this._registerAxisScale({
			axis       : "y",
			position   : "right",
			scale      : {
				min        : 0,
				max        : +1,
			},
			tickPadding: 16,
			label      : speed.label,
			labelX     : 25,
			labelY     : -8,
			name       : "speed"
		});

		this._registerAreaPath({
			name       : 'speed',
			label      : 'Speed',
			yAttr      : "speed",
			scaleX     : 'distance',
			scaleY     : 'speed',
			color      : '#03ffff',
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

		let deltaT = currT - prevT;

		let track  = this.track_info;
		let sMax   = track.speed_max || -Infinity; // Speed Max
		let sMin   = track.speed_min || +Infinity; // Speed Min
		let sAvg   = track.speed_avg || 0;         // Speed Avg
		let speed  = 0;

		if (deltaT > 0) {
			let delta = (data[i].dist - data[i > 0 ? i - 1 : i].dist) * 1000;
			speed = Math.abs((delta / deltaT) * opts.timeFactor) * opts.speedFactor;
		}

		// Try to smooth "crazy" speed values.
		if (this.options.speedDeltaMax) {
			let deltaS    = i > 0 ? speed - data[i - 1].speed : 0;
			let maxDeltaS = this.options.speedDeltaMax;
			if (Math.abs(deltaS) > maxDeltaS) {
				speed       = data[i - 1].speed + maxDeltaS * Math.sign(deltaS);
			}
		}

		// Range of acceptable speed values.
		speed = _.clamp(speed, this.options.speedRange);

		track.speed_max = speed > sMax ? speed : sMax;
		track.speed_min = speed < sMin ? speed : sMin;
		track.speed_avg = (speed + sAvg) / 2.0;

		data[i].speed = L.Util.formatNum(speed, 2);
	});

	if (this.options.speed) {

		this._registerTooltip({
			name: 'speed',
			chart: (item) => L._('v: ') + item.speed + " " + speed.label,
			marker: (item) => Math.round(item.speed) + " " + speed.label,
		});

		this._registerSummary({
			"minspeed"  : {
				label: "Min Speed: ",
				value: (track) => Math.round(track.speed_min || 0) + '&nbsp;' + speed.label
			},
			"maxspeed"  : {
				label: "Max Speed: ",
				value: (track) => Math.round(track.speed_max || 0) + '&nbsp;' + speed.label
			},
			"avgspeed": {
				label: "Avg Speed: ",
				value: (track) => Math.round(track.speed_avg || 0) + '&nbsp;' + speed.label
			}
		});

	}

});
