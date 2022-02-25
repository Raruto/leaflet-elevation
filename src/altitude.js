import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	let opts     = this.options;
	let altitude = {};

	if (opts.imperial) {
		opts.altitudeFactor = this.__footFactor;
		altitude.label      = "ft";
	} else {
		opts.altitudeFactor = opts.heightFactor || opts.altitudeFactor || 1;
		altitude.label      = opts.yLabel;
	}

	this.on("eledata_updated", function(e) {
		let data   = this._data;
		let i      = e.index;
		let z      = data[i].z * opts.altitudeFactor;

		let track  = this.track_info;
		let zMax = track.elevation_max || -Infinity;
		let zMin = track.elevation_min || +Infinity;

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
			this._lastValidZ = z;
		}

		track.elevation_max = z > zMax ? z : zMax;
		track.elevation_min = z < zMin ? z : zMin;

		data[i].z = z;
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

			this._chart._registerAxisScale({
				axis    : "y",
				position: "left",
				scale   : this._chart._y,
				label   : altitude.label,
				labelX  : -3,
				labelY  : -8,
				name    : "altitude",
			});

		});

		this.on("elechart_init", function() {

			let theme      = this.options.theme.replace('-theme', '');
			let color      = D3.Colors[theme] || {};

			this._chart._registerAreaPath({
				name         : 'altitude',
				label        : 'Altitude',
				scaleX       : 'distance',
				scaleY       : 'altitude',
				color        : color.area || theme,
				strokeColor  : this.options.detached ? color.stroke : '#000',
				strokeOpacity: "1",
				fillOpacity  : this.options.detached ? (color.alpha || '0.8') : 1,
				preferCanvas : this.options.preferCanvas,
			});

		});

	}

	this._registerTooltip({
		name: 'y',
		chart: (item) => L._("y: ") + d3.format("." + opts.decimalsY + "f")(item[opts.yAttr]) + " " + altitude.label,
		marker: (item) => d3.format("." + opts.decimalsY + "f")(item[opts.yAttr]) + " " + altitude.label,
	});

	this._registerSummary({
		"maxele"  : {
			label: "Max Elevation: ",
			value: (track) => (track.elevation_max || 0).toFixed(2) + '&nbsp;' + altitude.label
		},
		"minele"  : {
			label: "Min Elevation: ",
			value: (track) => (track.elevation_min || 0).toFixed(2) + '&nbsp;' + altitude.label
		},
	});

});
