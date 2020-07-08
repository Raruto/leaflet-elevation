import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (this.options.imperial) {
		this._heightFactor = this.__footFactor;
		this._yLabel = "ft";
	} else {
		this._heightFactor = this.options.heightFactor;
		this._yLabel = this.options.yLabel;
	}

	this.on("eledata_updated", function(e) {
		let data = this._data;
		let i = e.index;
		let z = data[i].z * this._heightFactor;

		let eleMax = this._maxElevation || -Infinity;
		let eleMin = this._minElevation || +Infinity;

		// check and fix missing elevation data on last added point
		if (!this.options.skipNullZCoords && i > 0) {
			let prevZ = data[i - 1].z;
			if (isNaN(prevZ)) {
				let lastZ = this._lastValidZ;
				let currZ = z;
				if (!isNaN(lastZ) && !isNaN(currZ)) {
					prevZ = (lastZ + currZ) / 2;
				} else if (!isNaN(lastZ)) {
					prevZ = lastZ;
				} else if (!isNaN(currZ)) {
					prevZ = currZ;
				}
				if (!isNaN(prevZ)) return data.splice(i - 1, 1);
				data[i - 1].z = prevZ;
			}
		}
		// skip point if it has not elevation
		if (!isNaN(z)) {
			eleMax = eleMax < z ? z : eleMax;
			eleMin = eleMin > z ? z : eleMin;
			this._lastValidZ = z;
		}

		data[i].z = z;

		this.track_info.elevation_max = this._maxElevation = eleMax;
		this.track_info.elevation_min = this._minElevation = eleMin;
	});

	this.on("elechart_legend", function() {
		this._altitudeLegend = this._chart._legend.append('g')
			.call(
				D3.LegendItem({
					name: 'Altitude',
					width: this._width(),
					height: this._height(),
					margins: this.options.margins,
				})
			);
	});

	this.on("elechart_summary", function() {
		this.track_info.elevation_max = this._maxElevation || 0;
		this.track_info.elevation_min = this._minElevation || 0;

		this._summary
			.append("maxele", L._("Max Elevation: "), this.track_info.elevation_max.toFixed(2) + '&nbsp;' + this._yLabel)
			.append("minele", L._("Min Elevation: "), this.track_info.elevation_min.toFixed(2) + '&nbsp;' + this._yLabel);
	});

	this.on("eledata_clear", function() {
		this._maxElevation = null;
		this._minElevation = null;
	});

});
