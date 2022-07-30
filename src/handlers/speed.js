export function Speed() {

	const _ = L.Control.Elevation.Utils;

	let opts = this.options;
	let speed = {};

	speed.label      = opts.speedLabel  || L._(opts.imperial ? 'mph' : 'km/h');
	opts.speedFactor = opts.speedFactor || 1;

	return {
		name: 'speed',
		required: (this.options.acceleration),
		unit: speed.label,
		deltaMax: this.options.speedDeltaMax,
		clampRange: this.options.speedRange,
		decimals: 2,
		pointToAttr: (_, i) => {
			let dx   = (this._data[i].dist - this._data[i > 0 ? i - 1 : i].dist) * 1000;
			let dt   = this._data[i].time - this._data[ i > 0 ? i - 1 : i].time;
			return (dt && dt > 0) ? Math.abs((dx / dt) * opts.timeFactor) * opts.speedFactor : 0;
		},
		stats: { max: _.iMax, min: _.iMinP, avg: _.iAvg },
		scale : (this.options.speed && this.options.speed != "summary") && {
			axis       : "y",
			position   : "right",
			scale      : { min : 0, max : +1 },
			tickPadding: 16,
			labelX     : 25,
			labelY     : -8,
		},
		path: (this.options.speed && this.options.speed != "summary") && {
			// name         : 'speed',
			label        : 'Speed',
			yAttr        : "speed",
			scaleX       : 'distance',
			scaleY       : 'speed',
			color        : '#03ffff',
			strokeColor  : '#000',
			strokeOpacity: "0.5",
			fillOpacity  : "0.25",
		},
		tooltip: (this.options.speed) && {
			chart: (item) => L._('v: ') + _.tooltipvalue(item.speed,2) + " " + speed.label,
			marker: (item) => _.tooltipvalue(item.speed,3) + " " + speed.label,
			order: 50,
		},
		summary: (this.options.speed) && {
			"minspeed"  : {
				label: "Min Speed: ",
				value: (track, unit) => _.tooltipvalue(track.speed_min,2) + '&nbsp;' + unit,
				order: 51
			},
			"maxspeed"  : {
				label: "Max Speed: ",
				value: (track, unit) => _.tooltipvalue(track.speed_max,2) + '&nbsp;' + unit,
				order: 51
			},
			"avgspeed": {
				label: "Avg Speed: ",
				value: (track, unit) => _.tooltipvalue(Math.abs((track.distance * 1000 / track.time) * opts.timeFactor) * opts.speedFactor,2) + '&nbsp;' + unit,
				order: 52
			},
		}
	};
}
