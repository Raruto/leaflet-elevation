export function Distance() {

	const _ = L.Control.Elevation.Utils;

	let opts     = this.options;
	let distance = {};

	opts.distanceFactor = opts.imperial ? this.__mileFactor : (opts.distanceFactor || 1); // 1 km = (1000 m)
	distance.label      = opts.imperial ? "mi" : opts.xLabel;

	return {
		name: 'distance',
		required: true,
		attr: 'dist',
		unit: distance.label,
		decimals: 5,
		pointToAttr: (_, i) => (i > 0 ? this._data[i - 1].dist : 0) + (this._data[i].latlng.distanceTo(this._data[i > 0 ? i - 1 : i].latlng) * opts.distanceFactor) / 1000, // convert back km to meters
		// stats: { total: _.iSum },
		onPointAdded: (distance, i) => this.track_info.distance = distance,
		scale: opts.distance && {
			axis    : "x",
			position: "bottom",
			scale   : "x", // this._chart._x,
			labelY  : 25,
			labelX  : () => this._width() + 6,
			ticks   : () => _.clamp(this._chart._xTicks() / 2, [4, +Infinity]),
		},
		grid: opts.distance && {
			axis      : "x",
			position  : "bottom",
			scale     : "x" // this._chart._x,
		},
		tooltip: opts.distance && {
			name: 'x',
			chart: (item) => L._("x: ") + (_.tooltipvalue(item[opts.xAttr], (item[opts.xAttr] > 10 ? 3 : 2)) || 0) + " " + distance.label,
			order: 20
		},
		summary: opts.distance && {
			"totlen"  : {
				label: "Total Length: ",
				value: (track) => (_.tooltipvalue(track.distance,(track.distance > 10 ? 3 : 2)) || 0) + '&nbsp;' + distance.label,
				order: 10
			}
		}
	};
}
