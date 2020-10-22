import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.speed) return;

	let opts = this.options;
	let speed = {};
	opts.margins.right = 50;

	speed.label = L._(this.options.imperial ? 'mph' : 'km/h');

	if (this.options.speed != "summary") {

		this.on("elechart_init", function() {
			speed.path = this._chart._area.append('path')
				.style("pointer-events", "none")
				// TODO: add a class here.
				.attr("fill", "#03ffff")
				.attr("stroke", "#000")
				.attr("stroke-opacity", "0.5")
				.attr("fill-opacity", "0.25");
		});

		this.on("elechart_axis", function() {
			speed.x = this._chart._x;

			speed.y = D3.Scale({
				data: this._data,
				range: [this._height(), 0],
				attr: "speed",
				min: 0,
				max: +1,
				forceBounds: opts.forceAxisBounds
			});

			speed.axis = D3.Axis({
				axis: "y",
				position: "right",
				width: this._width(),
				height: this._height(),
				scale: speed.y,
				ticks: this.options.yTicks,
				tickPadding: this.options.slope === true ? 36 : 18,
				label: speed.label,
				labelX: this.options.slope === true ? 50 : 35,
				labelY: 3
			});

			this._chart._axis.call(speed.axis);
		});

		this.on("elechart_area", function() {
			speed.area = D3.Area({
				interpolation: opts.sInterpolation,
				data: this._data,
				name: 'Speed',
				xAttr: opts.xAttr,
				yAttr: "speed",
				width: this._width(),
				height: this._height(),
				scaleX: speed.x,
				scaleY: speed.y
			});
			speed.path.call(speed.area);
		});

		this.on("elechart_legend", function() {
			speed.legend = this._chart._legend.append("g")
				.call(
					D3.LegendItem({
						name: 'Speed',
						width: this._width(),
						height: this._height(),
						margins: this.options.margins
					}));

			if (this.options.slope === true) {
				this._altitudeLegend
					.attr("transform", "translate(-100, 0)");

				this._chart._legend.select('.legend-slope')
					.attr("transform", "translate(0, 0)");

				speed.legend.attr("transform", "translate(100, 0)");
			} else {
				this._altitudeLegend
					.attr("transform", "translate(-50, 0)");

				speed.legend
					.attr("transform", "translate(50, 0)");
			}

			speed.legend.select("rect")
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

		let deltaT = currT - prevT;

		let sMax = this._maxSpeed || -Infinity; // Speed Max
		let sMin = this._minSpeed || +Infinity; // Speed Min
		let sAvg = this._avgSpeed || 0; // Speed Avg
		let speed = 0;

		if (deltaT > 0) {
			let curr = data[i].latlng;
			let prev = i > 0 ? data[i - 1].latlng : curr;

			let delta = curr.distanceTo(prev) * this._distanceFactor;

			speed = Math.abs((delta / deltaT) * this._timeFactor);
		}

		// Try to smooth "crazy" speed values.
		if (this.options.speedDeltaMax) {
			let deltaS = i > 0 ? speed - data[i - 1].speed : 0;
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

	this.on("elechart_change", function(e) {
		let item = e.data;
		let chart = this._chart;
		let marker = this._marker;

		if (chart._focuslabel) {
			if (!chart._focuslabelSpeed || !chart._focuslabelSpeed.property('isConnected')) {
				chart._focuslabelSpeed = chart._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x")
					.attr("class", "mouse-focus-label-speed")
					.attr("dy", "1.5em");
			}

			chart._focuslabelSpeed.text(item.speed + " " + speed.label);

			chart._focuslabel.select('.mouse-focus-label-x')
				.attr("dy", "1.5em");
		}

		if (marker._focuslabel) {
			if (!chart._mouseSpeedFocusLabel) {
				chart._mouseSpeedFocusLabel = marker._focuslabel.append("svg:tspan")
					.attr("class", "height-focus-speed ");
			}

			chart._mouseSpeedFocusLabel
				.attr("dy", "1.5em")
				.text(Math.round(item.speed) + " " + speed.label);

			marker._focuslabel.select('.height-focus-y')
				.attr("dy", "-1.5em");
		}
	});

	this.on("elechart_summary", function() {
		this.track_info.speed_max = this._maxSpeed || 0;
		this.track_info.speed_min = this._minSpeed || 0;

		this._summary
			.append("minspeed", L._("Min Speed: "), Math.round(this.track_info.speed_min) + '&nbsp;' + speed.label)
			.append("maxspeed", L._("Max Speed: "), Math.round(this.track_info.speed_max) + '&nbsp;' + speed.label)
			.append("avgspeed", L._("Avg Speed: "), Math.round(this.track_info.speed_avg) + '&nbsp;' + speed.label);
	});

	this.on("eledata_clear", function() {
		this._maxSpeed = null;
		this._minSpeed = null;
	});

});
