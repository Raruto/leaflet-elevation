import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	let opts     = this.options;
	let distance = {};

	if (opts.imperial) {
		opts.distanceFactor = this.__mileFactor;
		distance.label      = "mi";
	} else {
		opts.distanceFactor = opts.distanceFactor || 1;
		distance.label      = opts.xLabel;
	}

	this._registerDataAttribute({
		name: 'dist',
		init: () => {
			// this.track_info.distance = 0;
		},
		fetch: (i) => {
			let delta = this._data[i].latlng.distanceTo(this._data[i > 0 ? i - 1 : i].latlng) * opts.distanceFactor;
			return Math.round(delta / 1000 * 100000) / 100000; // handles floating points calc
		},
		update: (distance) => {
			this.track_info.distance = this.track_info.distance || 0;
			this.track_info.distance += distance;
			return this.track_info.distance;
		}
	});

	if (this.options.distance != "summary") {

		this._registerAxisScale({
			axis    : "x",
			position: "bottom",
			scale   : "x", // this._chart._x,
			label   : distance.label,
			labelY  : 25,
			labelX  : () => this._width() + 6,
			name    : "distance",
		});

	}

	this._registerAxisGrid({
		axis      : "x",
		position  : "bottom",
		scale     : "x" // this._chart._x,
	});

	this._registerTooltip({
		name: 'x',
		chart: (item) => L._("x: ") + d3.format("." + opts.decimalsX + "f")(item[opts.xAttr]) + " " + distance.label,
		order: 20
	});

	this._registerSummary({
		"totlen"  : {
			label: "Total Length: ",
			value: (track) => (track.distance || 0).toFixed(2) + '&nbsp;' + distance.label,
			order: 10
		}
	});

});
