import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	this.on("elechart_legend", function() {
		this._altitudeLegend = this._legend.append('g')
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
		this.summaryDiv.innerHTML +=
			'<span class="totlen"><span class="summarylabel">' + L._("Total Length: ") + '</span><span class="summaryvalue">' + this.track_info.distance.toFixed(2) + '&nbsp;' + this._xLabel + '</span></span>' +
			'<span class="maxele"><span class="summarylabel">' + L._("Max Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_max.toFixed(2) + '&nbsp;' + this._yLabel + '</span></span>' +
			'<span class="minele"><span class="summarylabel">' + L._("Min Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_min.toFixed(2) + '&nbsp;' + this._yLabel + '</span></span>';
	});

	this.on("eledata_clear", function() {
		this._maxElevation = null;
		this._minElevation = null;
	});

});
