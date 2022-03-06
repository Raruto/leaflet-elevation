import 'leaflet-i18n';
import * as _        from './utils';
import * as D3       from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

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

	this._registerDataAttribute({
		name: 'time',
		init: function({ point, props, id }) {
			// "coordinateProperties" property is generated inside "@tmcw/toGeoJSON"
			if (props) {
				if("coordTimes" in props)     point.meta.time = new Date(Date.parse(props.coordTimes[id]));
				else if("times" in props)     point.meta.time = new Date(Date.parse(props.times[id]));
				else if("time" in props)      point.meta.time = new Date(Date.parse((typeof props.time === 'object' ? props.time[id] : props.time)));
			}
		},
		fetch: function(i, point) {
			// Add missing timestamps (see: options.timeAVGSpeed)
			if (!point.meta || !point.meta.time) {
				point.meta = point.meta || {};
				if(i > 0) {
					let dx = (this._data[i].dist - this._data[i - 1].dist);
					let t0 = this._data[i - 1].time.getTime();
					let dt = ( dx / this._timeAVGSpeed) * this.options.timeFactor * 1000;
					point.meta.time = new Date(t0 + dt);
				} else {
					point.meta.time = new Date(Date.now())
				}
			}
			let time = point.meta.time;
			// Handle timezone offset
			if (time.getTime() - time.getTimezoneOffset() * 60 * 1000 === 0) {
				time = 0;
			}
			return time;
		},
		update: function(time, i) {
			this.track_info.time   = (this.track_info.time || 0) + Math.abs(this._data[i].time - this._data[i > 0 ? i - 1 : i].time);
			this._data[i].duration = this.track_info.time;
			return time;
		}
	});

	if (opts.time && opts.time != "summary" && !L.Browser.mobile) {

		this._registerAxisScale({
			axis       : "x",
			position   : "top",
			scale      : {
				attr       : "duration",
				min        : 0,
			},
			label      : time.label,
			labelY     : -10,
			labelX     : () => this._width(),
			name       : "time",
			tickFormat : (d)  => (d == 0 ? '' : opts.xTimeFormat(d)),
			onAxisMount: axis => {
				axis.select(".domain")
					.remove();
				axis.selectAll("text")
					.attr('opacity', 0.65)
					.style('font-family', 'Monospace')
					.style('font-size', '110%');
				axis.selectAll(".tick line")
					.attr('y2', this._height())
					.attr('stroke-dasharray', 2)
					.attr('opacity', 0.75);
				}
		});

	}

	if (this.options.timestamps) {
		this._registerTooltip({
			name: 'date',
			chart: (item) => L._("t: ") + this.options.timeFormat(item.time),
			order: 20,
		});
	}

	if (this.options.time) {
		this._registerTooltip({
			name: 'time',
			chart: (item) => L._("T: ") + _.formatTime(item.duration || 0),
			order: 20
		});
		this._registerSummary({
			"tottime"  : {
				label: "Total Time: ",
				value: (track) => _.formatTime(track.time || 0),
				order: 20
			}
		});
	}

});
