import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	let opts     = this.options;
	let altitude = {};

	if (opts.imperial) {
		this._heightFactor = this.__footFactor;
		this._yLabel       = "ft";
	} else {
		this._heightFactor = opts.heightFactor;
		this._yLabel       = opts.yLabel;
	}

	this.on("eledata_updated", function(e) {
		let data   = this._data;
		let i      = e.index;
		let z      = data[i].z * this._heightFactor;

		let track  = this.track_info;
		let eleMax = track.elevation_max || -Infinity;
		let eleMin = track.elevation_min || +Infinity;

		// check and fix missing elevation data on last added point
		if (!this.options.skipNullZCoords && i > 0) {
			let prevZ = data[i - 1].z;
			if (isNaN(prevZ)) {
				let lastZ = this._lastValidZ;
				let currZ = z;
				if (!isNaN(lastZ) && !isNaN(currZ)) {
					prevZ   = (lastZ + currZ) / 2;
				} else if (!isNaN(lastZ)) {
					prevZ   = lastZ;
				} else if (!isNaN(currZ)) {
					prevZ   = currZ;
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

		track.elevation_max = eleMax;
		track.elevation_min = eleMin;
	});

	this.on("elechart_axis", function() {

		this._chart._registerAxisGrid({
			axis      : "y",
			position  : "left",
			scale     : this._chart._y,
		});

	});

	if (this.options.altitude != "summary") {

		this.on("elechart_axis", function() {

			altitude.y     = this._chart._y;
			altitude.label = this._yLabel;

			this._chart._registerAxisScale({
				axis    : "y",
				position: "left",
				scale   : altitude.y,
				label   : altitude.label,
				labelX  : -3,
				labelY  : -8,
				name    : "altitude",
			});

		});

		this.on("elechart_init", function() {

			let theme      = this.options.theme.replace('-theme', '');
			let color      = D3.Colors[theme] || {};
			let alpha      = (this.options.detached ? (color.alpha || '0.8') : 1);
			let stroke     = (this.options.detached ? color.stroke : false);

			this._chart._registerAreaPath({
				name         : 'altitude',
				label        : 'Altitude',
				scaleX       : 'distance',
				scaleY       : 'altitude',
				color        : color.area || theme,
				strokeColor  : stroke || '#000',
				strokeOpacity: "1",
				fillOpacity  : alpha,
				preferCanvas : this.options.preferCanvas,
			});

		});

	}

	this._registerSummary({
		"maxele"  : {
			label: "Max Elevation: ",
			value: (track) => (track.elevation_max || 0).toFixed(2) + '&nbsp;' + this._yLabel
		},
		"minele"  : {
			label: "Min Elevation: ",
			value: (track) => (track.elevation_min || 0).toFixed(2) + '&nbsp;' + this._yLabel
		},
	});

});
