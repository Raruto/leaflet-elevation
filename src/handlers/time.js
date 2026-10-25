export function Time() {

	const _ = L.Control.Elevation.Utils;

	let opts = this.options;
	let time = {};

	time.label      = opts.timeLabel  || 't';
	opts.timeFactor = opts.timeFactor || 3600;

	/**
	 * Common AVG speeds:
	 * ----------------------
	 *  slow walk = 1.8  km/h
	 *  walking   = 3.6  km/h <-- default: 3.6
	 *  running   = 10.8 km/h
	 *  cycling   = 18   km/h
	 *  driving   = 72   km/h
	 * ----------------------
	 */
	this._timeAVGSpeed = (opts.timeAVGSpeed || 3.6) * (opts.speedFactor || 1);

	if (!opts.timeFormat) {
		opts.timeFormat = (time) => (new Date(time)).toLocaleString().replaceAll('/', '-').replaceAll(',', ' ');
	} else if (opts.timeFormat == 'time') {
		opts.timeFormat = (time) => (new Date(time)).toLocaleTimeString();
	} else if (opts.timeFormat == 'date') {
		opts.timeFormat = (time) => (new Date(time)).toLocaleDateString();
	}

	opts.xTimeFormat = opts.xTimeFormat || ((t) => _.formatTime(t).split("'")[0]);

	return {
		name: 'time',
		required: (this.options.speed || this.options.acceleration || this.options.timestamps),
		coordinateProperties: ["coordTimes", "times", "time"],
		coordPropsToMeta: _.parseDate,
		pointToAttr: function(point, i) {
			// Add missing timestamps (see: options.timeAVGSpeed)
			if (!point.meta || !point.meta.time) {
				point.meta = point.meta || {};
				if (i > 0) {
					let dx = this._data[i].latlng.distanceTo(this._data[i - 1].latlng) / 1000;
					let t0 = this._data[i - 1].time.getTime();
					point.meta.time = new Date(t0 + ( dx / this._timeAVGSpeed) * this.options.timeFactor * 1000);
				} else {
					point.meta.time = new Date(Date.now())
				}
			}
			// Handle timezone offset
			let time = (point.meta.time.getTime() - point.meta.time.getTimezoneOffset() * 60 * 1000 !== 0) ? point.meta.time : 0;
			// Update duration
			this._data[i].duration = i > 0 ? (this._data[i - 1].duration || 0) + Math.abs(time - this._data[i - 1].time) : 0;
			return time;
		},
		onPointAdded: (_, i) => this.track_info.time = this._data[i].duration,
		scale: (opts.time && opts.time != "summary" && !L.Browser.mobile) && {
			axis       : "x",
			position   : "top",
			scale      : "x",
			label      : time.label,
			labelY     : -10,
			labelX     : () => this._width(),
			name       : "time",
			ticks      : () => _.clamp(this._chart._xTicks() / 2, [4, +Infinity]),
			tickFormat : (distance) => {
				const data = this._data;
				if (!data.length) return '';
				const i = _.bisect(data, distance, opts.xAttr, true);
				const start = data[Math.max(0, i - 1)];
				const end = data[Math.min(i, data.length - 1)];
				const span = end[opts.xAttr] - start[opts.xAttr];
				// Time is only linear between consecutive recorded points, not across the whole track.
				const fraction = span ? _.clamp((distance - start[opts.xAttr]) / span, [0, 1]) : 0;
				const duration = start.duration + fraction * (end.duration - start.duration);
				return duration == 0 ? '' : opts.xTimeFormat(duration);
			},
			onAxisMount: axis => {
				axis.querySelector(".domain").remove();
				axis.querySelectorAll("text").forEach(text => {
					text.setAttribute('opacity', 0.65);
					text.style.fontFamily = 'Monospace';
					text.style.fontSize = '110%';
				});
				axis.querySelectorAll(".tick line").forEach(line => _.setAttributes(line, {
					y2: this._height(), 'stroke-dasharray': 2, opacity: 0.75,
				}));
				}
		},
		tooltips: [
			(this.options.time) && {
				name: 'time',
				chart: (item) => L._("T: ") + _.formatTime(item.duration || 0),
				order: 20
			},
			(this.options.timestamps) && {
				name: 'date',
				chart: (item) => L._("t: ") + this.options.timeFormat(item.time),
				order: 21,
			}
		],
		summary: (this.options.time) && {
			"tottime"  : {
				label: "Total Time: ",
				value: (track) => _.formatTime(track.time || 0),
				order: 20
			}
		}
	};
}