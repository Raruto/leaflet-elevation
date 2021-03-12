import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.speed && !this.options.acceleration) return;

	let opts = this.options;
	let speed = {};

	speed.label          = opts.speedLabel || L._(this.options.imperial ? 'mph' : 'km/h');
	this._speedFactor    = opts.speedFactor || 1;

	if (this.options.speed && this.options.speed != "summary") {

		this.on("elechart_axis", function() {
			speed.x = this._chart._x;
			speed.y = this._chart._registerAxisScale({
				axis       : "y",
				position   : "right",
				scale      : {
					range      : [this._height(), 0],
					attr       : "speed",
					min        : 0,
					max        : +1,
				},
				ticks      : this.options.yTicks,
				tickPadding: 16,
				label      : speed.label,
				labelX     : 25,
				labelY     : -8,
				name       : "speed"
			});
		});

		this.on("elechart_init", function() {

			this._chart._registerAreaPath({
				name       : 'speed',
				label      : 'Speed',
				xAttr      : opts.xAttr,
				yAttr      : "speed",
				scaleX     : speed.x,
				scaleY     : speed.y,
				color      : '#03ffff',
				strokeColor  : '#000',
				strokeOpacity: "0.5",
				fillOpacity  : "0.25",
			});

		});

	}

	this.on('elepoint_added', function(e) {
		let data   = this._data;
		let i      = e.index;

		let currT  = data[i].time;
		let prevT  = i > 0 ? data[i - 1].time : currT;

		let deltaT = currT - prevT;

		let sMax   = this._maxSpeed || -Infinity; // Speed Max
		let sMin   = this._minSpeed || +Infinity; // Speed Min
		let sAvg   = this._avgSpeed || 0; // Speed Avg
		let speed  = 0;

		if (deltaT > 0) {
			let delta = (data[i].dist - data[i > 0 ? i - 1 : i].dist) * 1000;
			speed = Math.abs((delta / deltaT) * this._timeFactor) * this._speedFactor;
		}

		// Try to smooth "crazy" speed values.
		if (this.options.speedDeltaMax) {
			let deltaS    = i > 0 ? speed - data[i - 1].speed : 0;
			let maxDeltaS = this.options.speedDeltaMax;
			if (Math.abs(deltaS) > maxDeltaS) {
				speed = data[i - 1].speed + maxDeltaS * Math.sign(deltaS);
			}
		}

		// Range of acceptable speed values.
		if (this.options.speedRange) {
			let range = this.options.speedRange;
			if (speed < range[0]) speed = range[0];
			else if (speed > range[1]) speed = range[1];
		}

		speed = L.Util.formatNum(speed, 2);

		sMax = speed > sMax ? speed : sMax;
		sMin = speed < sMin ? speed : sMin;
		sAvg = (speed + sAvg) / 2.0;

		data[i].speed = speed;

		this.track_info.speed_max = this._maxSpeed = sMax;
		this.track_info.speed_min = this._minSpeed = sMin;
		this.track_info.speed_avg = this._avgSpeed = sAvg;
	});

	if (this.options.speed) {

		this.on("elechart_change", function(e) {
			let item = e.data;

			this._chart._registerFocusLabel({
				name: 'speed',
				value: item.speed + " " + speed.label
			});

			this._marker._registerFocusLabel({
				name: 'speed',
				value: Math.round(item.speed) + " " + speed.label
			});

		});

		this.on("elechart_summary", function() {
			this.track_info.speed_max = this._maxSpeed || 0;
			this.track_info.speed_min = this._minSpeed || 0;

			this._summary._registerSummary({
				"minspeed"  : {
					label: "Min Speed: ",
					value: Math.round(this.track_info.speed_min) + '&nbsp;' + speed.label
				},
				"maxspeed"  : {
					label: "Max Speed: ",
					value: Math.round(this.track_info.speed_max) + '&nbsp;' + speed.label
				},
				"avgspeed": {
					label: "Avg Speed: ",
					value: Math.round(this.track_info.speed_avg) + '&nbsp;' + speed.label
				}
			});

		});

	}

	this.on("eledata_clear", function() {
		this._maxSpeed = null;
		this._minSpeed = null;
	});

});
