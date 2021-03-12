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

		let eleMax = this._maxElevation || -Infinity;
		let eleMin = this._minElevation || +Infinity;

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

		this.track_info.elevation_max = this._maxElevation = eleMax;
		this.track_info.elevation_min = this._minElevation = eleMin;
	});

	this.on("elechart_axis", function() {

		this._chart._registerAxisGrid({
			axis      : "y",
			position  : "left",
			scale     : this._chart._y,
			ticks     : this.options.yTicks
		});

	});

	if (this.options.altitude != "summary") {

		this.on("elechart_axis", function() {

			altitude.x     = this._x;
			altitude.y     = this._y;
			altitude.label = this._yLabel;

			this._chart._registerAxisScale({
				axis    : "y",
				position: "left",
				scale   : altitude.y,
				ticks   : this._yTicks,
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
				xAttr        : opts.xAttr,
				yAttr        : opts.yAttr,
				scaleX       : this._x,
				scaleY       : this._y,
				color        : color.area || theme,
				strokeColor  : stroke || '#000',
				strokeOpacity: "1",
				fillOpacity  : alpha,
				preferCanvas : this.options.preferCanvas,
			});

		});

	}

	this.on("elechart_summary", function() {
		this.track_info.elevation_max = this._maxElevation || 0;
		this.track_info.elevation_min = this._minElevation || 0;

		this._summary._registerSummary({
			"maxele"  : {
				label: "Max Elevation: ",
				value: this.track_info.elevation_max.toFixed(2) + '&nbsp;' + this._yLabel
			},
			"minele"  : {
				label: "Min Elevation: ",
				value: this.track_info.elevation_min.toFixed(2) + '&nbsp;' + this._yLabel
			},
		});

	});

	this.on("eledata_clear", function() {
		this._maxElevation = null;
		this._minElevation = null;
	});

});
