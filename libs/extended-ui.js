/*
 * Copyright (c) 2020, GPL-3.0+ Project, Gérald Niel, Raruto
 *
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or (at your
 *  option) any later version.
 *
 *  This file is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see .
 */

L.Control.Elevation.addInitHook(function() {

	this.options.margins.right = 50;

	const D3 = L.Control.Elevation.Components;
	let slope = window.slope = {};
	let opts = this.options;

	this.on("elechart_init", function() {
		slope.path = this._area.append('path')
			.style("pointer-events", "none")
			.attr("fill", "#F00")
			.attr("stroke", "#000")
			.attr("stroke-opacity", "0.5")
			.attr("fill-opacity", "0.25");
		// .on('mouseover', function() { d3.select(this).attr('fill-opacity', '0.75') })
		// .on('mouseout', function() { d3.select(this).attr('fill-opacity', '0.25') });
	});

	this.on("elechart_axis", function() {
		slope.x = this._x;

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
		});

		this._axis.call(slope.axis);
	});

	this.on("elechart_updated", function() {
		slope.area = D3.Area({
			interpolation: "curveStepAfter",
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
		slope.legend = this._legend.append("g")
			.call(
				D3.LegendItem({
					name: 'Slope',
					width: this._width(),
					height: this._height(),
					margins: this.options.margins,
				})
			);

		this._altitudeLegend
			.attr("transform", "translate(-50, 0)");

		slope.legend
			.attr("transform", "translate(50, 0)");

		slope.legend.select("rect")
			.classed("area", false)
			// .attr("class", "area")
			.attr("fill", "#F00")
			.attr("stroke", "#000")
			.attr("stroke-opacity", "0.5")
			.attr("fill-opacity", "0.25");

		// autotoggle chart data on single click
		// slope.legend.on('click', function() {
		// 	if (this._chart2Enabled) {
		// 		// this._clearChart();
		// 		this._resetDrag();
		// 		if (slope.path) {
		// 			// workaround for 'Error: Problem parsing d=""' in Webkit when empty data
		// 			// https://groups.google.com/d/msg/d3-js/7rFxpXKXFhI/HzIO_NPeDuMJ
		// 			//this._areapath.datum(this._data).attr("d", this._area);
		// 			slope.path.attr("d", "M0 0");
		//
		// 			// slope.x.domain([0, 1]);
		// 			slope.y.domain([-1, +1]);
		// 			this._updateAxis();
		// 		}
		// 		if (slope.legend) {
		// 			slope.legend
		// 				.select('text')
		// 				.style("text-decoration-line", "line-through");
		// 		}
		// 		this._clearPath();
		// 		this._chart2Enabled = false;
		// 	} else {
		// 		this._resizeChart();
		// 		for (let id in this._layers) {
		// 			if (this._layers[id]._path) {
		// 				L.DomUtil.addClass(this._layers[id]._path, this.options.polyline.className + ' ' + this.options.theme);
		// 			}
		// 		}
		// 		this._chart2Enabled = true;
		// 	}
		// }.bind(this));
	});

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
		let diff = 0;
		let slope = 0;

		if (!isNaN(z)) {
			// diff height between actual and previous point
			diff = i > 0 ? z - data[i - 1].z : 0;
			if (diff > 0) tAsc += diff;
			if (diff < 0) tDes -= diff;
			// slope in % = ( height / length ) * 100
			slope = delta !== 0 ? Math.round((diff / delta) * 10000) / 100 : 0;
			// apply slope to the previous point because we will
			// ascent or desent, so the slope is in the fist point
			if (i > 0) data[i - 1].slope = slope;
			sMax = slope > sMax ? slope : sMax;
			sMin = slope < sMin ? slope : sMin;
		}

		data[i].slope = slope;

		this.track_info = this.track_info || {};
		this.track_info.ascent = this._tAsc = tAsc;
		this.track_info.descent = this._tDes = tDes;
		this.track_info.slope_max = this._sMax = sMax;
		this.track_info.slope_min = this._sMin = sMin;
	});

	if (!this.options.extendedUI) return;

	this.on("elechart_change", function(e) {
		let item = e.data;
		let xCoordinate = e.xCoord;

		if (!this._focuslabelSlope || !this._focuslabelSlope.property('isConnected')) {
			this._focuslabelSlope = this._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x")
				.attr("class", "mouse-focus-label-slope")
				.attr("dy", "1.5em");
		}

		this._focuslabelSlope.text(item.slope + "%");

		if (!this._mouseSlopeFocusLabel) {
			this._mouseSlopeFocusLabel = this._mouseHeightFocusLabel.append("svg:tspan")
				.attr("class", "height-focus-slope ");
		}

		this._mouseHeightFocusLabel.select('.height-focus-y')
			.attr("dy", "-1.5em");
		this._focuslabel.select('.mouse-focus-label-x')
			.attr("dy", "1.5em");

		this._mouseSlopeFocusLabel
			.attr("dy", "1.5em")
			.text(Math.round(item.slope) + "%");

	});

	this.on("elechart_summary", function() {
		this.track_info.ascent = this._tAsc || 0;
		this.track_info.descent = this._tDes || 0;
		this.track_info.slope_max = this._sMax || 0;
		this.track_info.slope_min = this._sMin || 0;

		this.summaryDiv.querySelector('.minele').insertAdjacentHTML('afterend', '<span class="ascent"><span class="summarylabel">' + L._("Total Ascent: ") + '</span><span class="summaryvalue">' + Math.round(this.track_info.ascent) + '&nbsp;' +
			this._yLabel +
			'</span></span>' + '<span class="descent"><span class="summarylabel">' + L._("Total Descent: ") + '</span><span class="summaryvalue">' + Math.round(this.track_info.descent) + '&nbsp;' + this._yLabel +
			'</span></span>' + '<span class="minslope"><span class="summarylabel">' + L._("Min Slope: ") + '</span><span class="summaryvalue">' + this.track_info.slope_min + '&nbsp;' + '%' +
			'</span></span>' + '<span class="maxslope"><span class="summarylabel">' + L._("Max Slope: ") + '</span><span class="summaryvalue">' + this.track_info.slope_max + '&nbsp;' + '%' +
			'</span></span>');
	});

	this.on("eledata_clear", function() {
		this._sMax = null;
		this._sMin = null;
		this._tAsc = null;
		this._tDes = null;
	});

});
