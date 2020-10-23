import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.slope) return;

	let opts = this.options;
	let slope = {};

	if (this.options.slope != "summary") {

		this.on("elechart_init", function() {
			slope.path = this._chart._area.append('path')
				.style("pointer-events", "none")
				// TODO: add a class here.
				.attr("fill", "#F00")
				.attr("stroke", "#000")
				.attr("stroke-opacity", "0.5")
				.attr("fill-opacity", "0.25");
		});

		this.on("elechart_axis", function() {
			slope.x = this._chart._x;

			// slope.x = D3.Scale({
			// 	data: this._data,
			// 	range: [0, this._width()],
			// 	attr: opts.xAttr,
			// 	min: opts.xAxisMin,
			// 	max: opts.xAxisMax,
			// 	forceBounds: opts.forceAxisBounds,
			// });

			slope.y = D3.Scale({
				data: this._data,
				range: [this._height(), 0],
				attr: "slope",
				min: -1,
				max: +1,
				forceBounds: opts.forceAxisBounds,
			});

			slope.axis = D3.Axis({
				axis: "y",
				position: "right",
				width: this._width(),
				height: this._height(),
				scale: slope.y,
				ticks: this.options.yTicks,
				tickPadding: 16,
				label: "%",
				labelX: 25,
				labelY: 3,
				name: "slope"
			});

			this._chart._axis.call(slope.axis);
		});

		this.on("elechart_area", function() {
			slope.area = D3.Area({
				interpolation: opts.sInterpolation,
				data: this._data,
				name: 'Slope',
				xAttr: opts.xAttr,
				yAttr: "slope",
				width: this._width(),
				height: this._height(),
				scaleX: slope.x,
				scaleY: slope.y,
			});

			slope.path.call(slope.area);
		});

		this.on("elechart_legend", function() {
			slope.legend = this._chart._legend.append("g")
				.call(
					D3.LegendItem({
						name: 'Slope',
						width: this._width(),
						height: this._height(),
						margins: this.options.margins,
					})
				);
			slope.legend.select("rect")
				.classed("area", false)
				// TODO: add a class here.
				.attr("fill", "#F00")
				.attr("stroke", "#000")
				.attr("stroke-opacity", "0.5")
				.attr("fill-opacity", "0.25");
		});
	}

	this.on("eledata_updated", function(e) {
		let data = this._data;
		let i = e.index;
		let z = data[i].z;

		let curr = data[i].latlng;
		let prev = i > 0 ? data[i - 1].latlng : curr;

		let delta = curr.distanceTo(prev) * this._distanceFactor;

		// Slope / Gain
		let tAsc = this._tAsc || 0; // Total Ascent
		let tDes = this._tDes || 0; // Total Descent
		let sMax = this._sMax || 0; // Slope Max
		let sMin = this._sMin || 0; // Slope Min
		let slope = 0;

		if (!isNaN(z)) {
			let deltaZ = i > 0 ? z - data[i - 1].z : 0;
			if (deltaZ > 0) tAsc += deltaZ;
			else if (deltaZ < 0) tDes -= deltaZ;
			// slope in % = ( height / length ) * 100
			slope = delta !== 0 ? (deltaZ / delta) * 100 : 0;
		}

		// Try to smooth "crazy" slope values.
		if (this.options.sDeltaMax) {
			let deltaS = i > 0 ? slope - data[i - 1].slope : 0;
			let maxDeltaS = this.options.sDeltaMax;
			if (Math.abs(deltaS) > maxDeltaS) {
				slope = data[i - 1].slope + maxDeltaS * Math.sign(deltaS);
			}
		}

		// Range of acceptable slope values.
		if (this.options.sRange) {
			let range = this.options.sRange;
			if (slope < range[0]) slope = range[0];
			else if (slope > range[1]) slope = range[1];
		}

		slope = L.Util.formatNum(slope, 2);

		sMax = slope > sMax ? slope : sMax;
		sMin = slope < sMin ? slope : sMin;

		data[i].slope = slope;

		this.track_info.ascent = this._tAsc = tAsc;
		this.track_info.descent = this._tDes = tDes;
		this.track_info.slope_max = this._sMax = sMax;
		this.track_info.slope_min = this._sMin = sMin;
	});

	this.on("elechart_change", function(e) {
		let item = e.data;
		let xCoordinate = e.xCoord;
		let chart = this._chart;
		let marker = this._marker;

		if (chart._focuslabel) {
			if (!chart._focuslabelSlope || !chart._focuslabelSlope.property('isConnected')) {
				chart._focuslabelSlope = chart._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x")
					.attr("class", "mouse-focus-label-slope")
					.attr("dy", "1.5em");
			}

			chart._focuslabelSlope.text(item.slope + "%");

			chart._focuslabel.select('.mouse-focus-label-x')
				.attr("dy", "1.5em");
		}

		if (marker._focuslabel) {
			if (!chart._mouseSlopeFocusLabel) {
				chart._mouseSlopeFocusLabel = marker._focuslabel.append("svg:tspan")
					.attr("class", "height-focus-slope ");
			}

			chart._mouseSlopeFocusLabel
				.attr("dy", "1.5em")
				.text(Math.round(item.slope) + "%");

			marker._focuslabel.select('.height-focus-y')
				.attr("dy", "-1.5em");
		}
	});

	this.on("elechart_summary", function() {
		this.track_info.ascent = this._tAsc || 0;
		this.track_info.descent = this._tDes || 0;
		this.track_info.slope_max = this._sMax || 0;
		this.track_info.slope_min = this._sMin || 0;

		this._summary
			.append("ascent", L._("Total Ascent: "), Math.round(this.track_info.ascent) + '&nbsp;' + this._yLabel)
			.append("descent", L._("Total Descent: "), Math.round(this.track_info.descent) + '&nbsp;' + this._yLabel)
			.append("minslope", L._("Min Slope: "), Math.round(this.track_info.slope_min) + '&nbsp;' + '%')
			.append("maxslope", L._("Max Slope: "), Math.round(this.track_info.slope_max) + '&nbsp;' + '%');
	});

	this.on("eledata_clear", function() {
		this._sMax = null;
		this._sMin = null;
		this._tAsc = null;
		this._tDes = null;
	});

});
