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

	this.on("eledata_updated", function(e) {
		let data = this._data;
		let z = data[e.idx].z;

		let curr = data[e.idx].latlng;
		let prev = e.idx > 0 ? data[e.idx - 1].latlng : curr;

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
			diff = e.idx > 0 ? z - data[e.idx - 1].z : 0;
			if (diff > 0) tAsc += diff;
			if (diff < 0) tDes -= diff;
			// slope in % = ( height / length ) * 100
			slope = delta !== 0 ? Math.round((diff / delta) * 10000) / 100 : 0;
			// apply slope to the previous point because we will
			// ascent or desent, so the slope is in the fist point
			if (e.idx > 0) data[e.idx - 1].slope = slope;
			sMax = slope > sMax ? slope : sMax;
			sMin = slope < sMin ? slope : sMin;
		}

		data[e.idx].slope = slope;

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
			this._focuslabelSlope = this._focuslabeltext.insert("svg:tspan", ".mouse-focus-label-x")
				.attr("class", "mouse-focus-label-slope")
				.attr("dy", "1.5em");
		}

		this._focuslabelSlope.text(item.slope + "%");

		// move focus label to left
		if (xCoordinate >= this._width() / 2) {
			this._focuslabelSlope.attr("x", this._focuslabelY.attr("x"));
		}

		if (!this._mouseSlopeFocusLabel) {
			let layerpane = d3.select(this._map.getContainer()).select(".leaflet-elevation-pane svg").select("g");

			this._mouseSlopeFocusLabel = layerpane.append("svg:text")
				.attr("class", this.options.theme + " height-focus-label ")
				.style("pointer-events", "none");
		}

		this._mouseHeightFocusLabel
			.attr("dy", "-1.5em");

		this._mouseSlopeFocusLabel
			.attr("x", this._mouseHeightFocusLabel.attr("x"))
			.attr("y", this._mouseHeightFocusLabel.attr("y"))
			.attr("dy", "-0.5em")
			.text(Math.round(item.slope) + "%")
			.style("visibility", "visible");

	});

	this.on("elechart_summary", function() {
		this.summaryDiv.querySelector('.download').insertAdjacentHTML('beforebegin', '<span class="ascent"><span class="summarylabel">' + L._("Total Ascent: ") + '</span><span class="summaryvalue">' + Math.round(this.track_info.ascent) + '&nbsp;' +
			this._yLabel +
			'</span></span>' + '<span class="descent"><span class="summarylabel">' + L._("Total Descent: ") + '</span><span class="summaryvalue">' + Math.round(this.track_info.descent) + '&nbsp;' + this._yLabel +
			'</span></span>' + '<span class="minslope"><span class="summarylabel">' + L._("Min Slope: ") + '</span><span class="summaryvalue">' + this.track_info.slope_min + '&nbsp;' + '%' +
			'</span></span>' + '<span class="maxslope"><span class="summarylabel">' + L._("Max Slope: ") + '</span><span class="summaryvalue">' + this.track_info.slope_max + '&nbsp;' + '%' +
			'</span></span>');
	});

});
