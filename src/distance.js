import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	let opts     = this.options;
	let distance = {};

	if (this.options.imperial) {
		this._distanceFactor = this.__mileFactor;
		this._xLabel         = "mi";
	} else {
		this._distanceFactor = opts.distanceFactor;
		this._xLabel         = opts.xLabel;
	}

	this.on("eledata_updated", function(e) {
		let data = this._data;
		let i    = e.index;

		let track = this.track_info;
		let dist  = track.distance || 0;

		let curr = data[i].latlng;
		let prev = i > 0 ? data[i - 1].latlng : curr;

		let delta = curr.distanceTo(prev) * this._distanceFactor;

		dist += Math.round(delta / 1000 * 100000) / 100000; // handles floating points calc

		data[i].dist = dist;

		track.distance = dist;
	});

	this.on("elechart_axis", function() {

		this._chart._registerAxisGrid({
			axis      : "x",
			position  : "bottom",
			scale     : this._chart._x,
		});

	});

	if (this.options.distance != "summary") {

		this.on("elechart_axis", function() {

			distance.x     = this._chart._x;
			distance.label = this._chart._xLabel;

			this._chart._registerAxisScale({
				axis    : "x",
				position: "bottom",
				scale   : distance.x,
				label   : distance.label,
				labelY  : 25,
				labelX  : () => this._width() + 6,
				name    : "distance",
			});

		});

	}

	this._registerSummary({
		"totlen"  : {
			label: "Total Length: ",
			value: (track) => (track.distance || 0).toFixed(2) + '&nbsp;' + this._xLabel
		}
	});

});
