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


	this._registerDataAttribute({
		name: 'speed',
		init: () => {
			// this.track_info.speed_max = -Infinity; // Speed Max
			// this.track_info.speed_min = +Infinity; // Speed Min
			// this.track_info.speed_avg = 0;         // Speed Avg
		},
		fetch: (i) => {
			let data = this._data;
			let dx   = (data[i].dist - data[i > 0 ? i - 1 : i].dist) * 1000;
			let dt   = data[i].time - data[ i > 0 ? i - 1 : i].time;
			return dt > 0 ? Math.abs((dx / dt) * opts.timeFactor) * opts.speedFactor : 0;
		},
		update: (speed, i) => {
			this.track_info.speed_max = this.track_info.speed_max || -Infinity; // Speed Max
			this.track_info.speed_min = this.track_info.speed_min || +Infinity; // Speed Min
			this.track_info.speed_avg = this.track_info.speed_avg || 0;         // Speed Avg

			let data  = this._data;
			let track = this.track_info;

			// Try to smooth "crazy" speed values.
			if (this.options.speedDeltaMax) {
				let delta    = speed - data[i > 0 ? i - 1 : i].speed;
				let deltaMax = this.options.speedDeltaMax;
				if (Math.abs(delta) > deltaMax) {
					speed       = data[i - 1].speed + deltaMax * Math.sign(delta);
				}
			}
	
			// Range of acceptable speed values.
			speed = _.clamp(speed, this.options.speedRange);

			if (speed > track.speed_max) track.speed_max = speed;
			if (speed < track.speed_min) track.speed_min = speed;

			track.speed_avg = (speed + track.speed_avg) / 2.0;

			return L.Util.formatNum(speed, 2);
		},
	});

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
			name       : "speed",
		});

		this._registerAreaPath({
			name         : 'speed',
			label        : 'Speed',
			yAttr        : "speed",
			scaleX       : 'distance',
			scaleY       : 'speed',
			color        : '#03ffff',
			strokeColor  : '#000',
			strokeOpacity: "0.5",
			fillOpacity  : "0.25",
		});

	}

	if (this.options.speed) {

		this._registerTooltip({
			name: 'speed',
			chart: (item) => L._('v: ') + item.speed + " " + speed.label,
			marker: (item) => Math.round(item.speed) + " " + speed.label,
			order: 50,
		});

		this._registerSummary({
			"minspeed"  : {
				label: "Min Speed: ",
				value: (track) => Math.round(track.speed_min || 0) + '&nbsp;' + speed.label,
				order: 50
			},
			"maxspeed"  : {
				label: "Max Speed: ",
				value: (track) => Math.round(track.speed_max || 0) + '&nbsp;' + speed.label,
				order: 50
			},
			"avgspeed": {
				label: "Avg Speed: ",
				value: (track) => Math.round(track.speed_avg || 0) + '&nbsp;' + speed.label,
				order: 50
			}
		});

	}

});
