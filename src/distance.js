import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (this.options.imperial) {
		this._distanceFactor = this.__mileFactor;
		this._xLabel = "mi";
	} else {
		this._distanceFactor = this.options.distanceFactor;
		this._xLabel = this.options.xLabel;
	}

	this.on("eledata_updated", function(e) {
		let data = this._data;
		let i = e.index;

		let dist = this._distance || 0;

		let curr = data[i].latlng;
		let prev = i > 0 ? data[i - 1].latlng : curr;

		let delta = curr.distanceTo(prev) * this._distanceFactor;

		dist = dist + Math.round(delta / 1000 * 100000) / 100000;

		data[i].dist = dist;

		this.track_info.distance = this._distance = dist;
	});

	this.on("elechart_summary", function() {
		this.track_info.distance = this._distance || 0;

		this._summary
			.append("totlen", L._("Total Length: "), this.track_info.distance.toFixed(2) + '&nbsp;' + this._xLabel);
	});

	this.on("eledata_clear", function() {
		this._distance = 0;
	});

});
