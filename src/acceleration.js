import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.acceleration) return;

	let opts = this.options;
	let acceleration = {};

	acceleration.label = L._(this.options.imperial ? 'ft/s²' : 'm/s²');

	if (this.options.acceleration != "summary") {

		this.on("elechart_init", function() {
			acceleration.path = this._chart._area.append('path')
				.style("pointer-events", "none")
				// TODO: add a class here.
				.attr("fill", "#050402")
				.attr("stroke", "#000")
				.attr("stroke-opacity", "0.5")
				.attr("fill-opacity", "0.25");
		});

		this.on("elechart_axis", function() {
			acceleration.x = this._chart._x;

			acceleration.y = D3.Scale({
				data: this._data,
				range: [this._height(), 0],
				attr: "acceleration",
				min: 0,
				max: +1,
				forceBounds: opts.forceAxisBounds
			});

			acceleration.axis = D3.Axis({
				axis: "y",
				position: "right",
				width: this._width(),
				height: this._height(),
				scale: acceleration.y,
				ticks: this.options.yTicks,
				tickPadding: 16,
				label: acceleration.label,
				labelX: 25,
				labelY: 3,
				name: 'acceleration'
			});

			this._chart._axis.call(acceleration.axis);
		});

		this.on("elechart_area", function() {
			acceleration.area = D3.Area({
				interpolation: opts.sInterpolation,
				data: this._data,
				name: 'Acceleration',
				xAttr: opts.xAttr,
				yAttr: "acceleration",
				width: this._width(),
				height: this._height(),
				scaleX: acceleration.x,
				scaleY: acceleration.y
			});
			acceleration.path.call(acceleration.area);
		});

		this.on("elechart_legend", function() {
			acceleration.legend = this._chart._legend.append("g")
				.call(
					D3.LegendItem({
						name: 'Acceleration',
						width: this._width(),
						height: this._height(),
						margins: this.options.margins
					}));
			acceleration.legend.select("rect")
				.classed("area", false)
				// TODO: add a class here.
				.attr("fill", "#03ffff")
				.attr("stroke", "#000")
				.attr("stroke-opacity", "0.5")
				.attr("fill-opacity", "0.25");

		});
	}

	this.on('elepoint_added', function(e) {
		let data = this._data;
		let i = e.index;

		let currT = data[i].time;
		let prevT = i > 0 ? data[i - 1].time : currT;

		let deltaT = (currT - prevT) / 1000;

		let sMax = this._maxAcceleration || -Infinity; // Acceleration Max
		let sMin = this._minAcceleration || +Infinity; // Acceleration Min
		let sAvg = this._avgAcceleration || 0; // Acceleration Avg
		let acceleration = 0;

		if (deltaT > 0) {
			let curr = data[i].speed;
			let prev = i > 0 ? data[i - 1].speed : curr;

			let delta = (curr - prev) * (1000 / this._timeFactor);

			acceleration = Math.abs((delta / deltaT));
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
		let chart = this._chart;
		let marker = this._marker;

		if (chart._focuslabel) {
			if (!chart._focuslabelAcceleration || !chart._focuslabelAcceleration.property('isConnected')) {
				chart._focuslabelAcceleration = chart._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x")
					.attr("class", "mouse-focus-label-acceleration")
					.attr("dy", "1.5em");
			}

			chart._focuslabelAcceleration.text(item.acceleration + " " + acceleration.label);

			chart._focuslabel.select('.mouse-focus-label-x')
				.attr("dy", "1.5em");
		}

		if (marker._focuslabel) {
			if (!chart._mouseAccelerationFocusLabel) {
				chart._mouseAccelerationFocusLabel = marker._focuslabel.append("svg:tspan")
					.attr("class", "height-focus-acceleration ");
			}

			chart._mouseAccelerationFocusLabel
				.attr("dy", "1.5em")
				.text(Math.round(item.acceleration) + " " + acceleration.label);

			marker._focuslabel.select('.height-focus-y')
				.attr("dy", "-1.5em");
		}
	});

	this.on("elechart_summary", function() {
		this.track_info.acceleration_max = this._maxAcceleration || 0;
		this.track_info.acceleration_min = this._minAcceleration || 0;

		this._summary
			.append("minacceleration", L._("Min Acceleration: "), Math.round(this.track_info.acceleration_min) + '&nbsp;' + acceleration.label)
			.append("maxacceleration", L._("Max Acceleration: "), Math.round(this.track_info.acceleration_max) + '&nbsp;' + acceleration.label)
			.append("avgacceleration", L._("Avg Acceleration: "), Math.round(this.track_info.acceleration_avg) + '&nbsp;' + acceleration.label);
	});

	this.on("eledata_clear", function() {
		this._maxAcceleration = null;
		this._minAcceleration = null;
	});

});
