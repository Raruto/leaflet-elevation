import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.acceleration) return;

	let opts = this.options;
	let acceleration = {};

	acceleration.label = opts.accelerationLabel || L._(this.options.imperial ? 'ft/s²' : 'm/s²');
	this._accelerationFactor = opts.accelerationFactor || 1;

	if (this.options.acceleration != "summary") {

		this.on("elechart_init", function() {
			acceleration.path = d3.create('svg:path');
		});

		this.on("elechart_axis", function() {
			acceleration.x = this._chart._x;
			acceleration.y = this._chart._registerAxisScale({
				axis       : "y",
				position   : "right",
				scale      : {
					range      : [this._height(), 0],
					attr       : "acceleration",
					min        : 0,
					max        : +1,
				},
				ticks      : this.options.yTicks,
				tickPadding: 16,
				label      : acceleration.label,
				labelX     : 25,
				labelY     : -8,
				name       : 'acceleration'
			});
		});

		this.on("elechart_init", function() {

			this._chart._registerAreaPath({
				name       : 'acceleration',
				label      : 'Acceleration',
				xAttr      : opts.xAttr,
				yAttr      : "acceleration",
				scaleX     : acceleration.x,
				scaleY     : acceleration.y,
				color      : '#050402',
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

		let deltaT = (currT - prevT) / 1000;

		let sMax   = this._maxAcceleration || -Infinity; // Acceleration Max
		let sMin   = this._minAcceleration || +Infinity; // Acceleration Min
		let sAvg   = this._avgAcceleration || 0; // Acceleration Avg
		let acceleration = 0;

		if (deltaT > 0) {
			let curr = data[i].speed;
			let prev = i > 0 ? data[i - 1].speed : curr;

			let delta = (curr - prev) * (1000 / this._timeFactor);

			acceleration = Math.abs((delta / deltaT)) * this._accelerationFactor;
		}

		// Try to smooth "crazy" acceleration values.
		if (this.options.accelerationDeltaMax) {
			let deltaA = i > 0 ? acceleration - data[i - 1].acceleration : 0;
			let maxDeltaS = this.options.accelerationDeltaMax;
			if (Math.abs(deltaA) > maxDeltaS) {
				acceleration = data[i - 1].acceleration + maxDeltaS * Math.sign(deltaA);
			}
		}

		// Range of acceptable acceleration values.
		if (this.options.accelerationRange) {
			let range = this.options.accelerationRange;
			if (acceleration < range[0]) acceleration = range[0];
			else if (acceleration > range[1]) acceleration = range[1];
		}

		acceleration = L.Util.formatNum(acceleration, 2);

		sMax = acceleration > sMax ? acceleration : sMax;
		sMin = acceleration < sMin ? acceleration : sMin;
		sAvg = (acceleration + sAvg) / 2.0;

		data[i].acceleration = acceleration;

		this.track_info.acceleration_max = this._maxAcceleration = sMax;
		this.track_info.acceleration_min = this._minAcceleration = sMin;
		this.track_info.acceleration_avg = this._avgAcceleration = sAvg;
	});

	this.on("elechart_change", function(e) {
		let item = e.data;

		this._chart._registerFocusLabel({
			name: 'acceleration',
			value: item.acceleration + " " + acceleration.label
		});

		this._marker._registerFocusLabel({
			name: 'acceleration',
			value: Math.round(item.acceleration) + " " + acceleration.label
		});

	});

	this.on("elechart_summary", function() {
		this.track_info.acceleration_max = this._maxAcceleration || 0;
		this.track_info.acceleration_min = this._minAcceleration || 0;

		this._summary._registerSummary({
			"minacceleration"  : {
				label: "Min Acceleration: ",
				value: Math.round(this.track_info.acceleration_min) + '&nbsp;' + acceleration.label
			},
			"maxacceleration"  : {
				label: "Max Acceleration: ",
				value: Math.round(this.track_info.acceleration_max) + '&nbsp;' + acceleration.label
			},
			"avgacceleration": {
				label: "Avg Acceleration: ",
				value: Math.round(this.track_info.acceleration_avg) + '&nbsp;' + acceleration.label
			}
		});

	});

	this.on("eledata_clear", function() {
		this._maxAcceleration = null;
		this._minAcceleration = null;
	});

});
