import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	this._timeFactor = this.options.timeFactor;

	let time = {};

	if (!this.options.timeFormat) {
		this.options.timeFormat = (time) => new Date(time).toLocaleString().replaceAll('/', '-').replaceAll(',', ' ');
	} else if (this.options.timeFormat == 'time') {
		this.options.timeFormat = (time) => new Date(time).toLocaleTimeString();
	} else if (this.options.timeFormat == 'date') {
		this.options.timeFormat = (time) => new Date(time).toLocaleDateString();
	}

	if (this.options.time && this.options.time != "summary" && !L.Browser.mobile) {

		this.on("elechart_axis", function() {

		if (!this.options.xTimeFormat) {
				this.options.xTimeFormat = d3.utcFormat("%H:%M");
		}

		time.y = this._chart._y;

		time.x = D3.Scale({
			data: this._data,
			range: [0, this._width()],
			attr: "duration",
			min: 0,
			// max: +1,
			// forceBounds: opts.forceAxisBounds
			// scale: 'scaleTime'
		});

		time.axis = D3.Axis({
			axis: "x",
			position: "top",
			width: this._width(),
			height: 0,
			scale: time.x,
			ticks: this.options.xTicks * 1.5,
			label: 't',
			labelY: -10,
			labelX: this._width(),
			name: "time",
			tickFormat: (d) => {
				let t = this.options.xTimeFormat(d)
				return (t =='00:00' ? '' : t);
			}
		});

		this._chart._axis
			.call(time.axis)
			.call(g => {
				let axis = g.select(".x.axis.time");
				axis.select(".domain").remove();
				axis.selectAll("text")
				.attr('opacity', 0.65)
				.style('font-family', 'Monospace')
				.style('font-size', '110%');
				axis.selectAll(".tick line")
					.attr('y2', this._height())
					.attr('stroke-dasharray', 2)
					.attr('opacity', 0.75);
				}
			)

		});

	}

	this.on('elepoint_added', function(e) {
		if (!e.point.meta || !e.point.meta.time) return;

		let data = this._data;
		let i = e.index;
		let time = e.point.meta.time;

		if (time.getTime() - time.getTimezoneOffset() * 60000 === 0) {
			time = 0;
		}

		data[i].time = time;

		let currT = data[i].time;
		let prevT = i > 0 ? data[i - 1].time : currT;

		let deltaT   = Math.abs(currT - prevT);
		let duration = (this.track_info.time || 0) + deltaT;

		data[i].duration = duration;

		this.track_info.time = duration;
	});

	if (!this.options.time) return;

	this.on("elechart_change", function(e) {
		let chart = this._chart;
		let item = e.data;

		if (chart._focuslabel) {
			if (item.time) {
				if (!chart._focuslabelTime || !chart._focuslabelTime.property('isConnected')) {
					chart._focuslabelTime = chart._focuslabel.select('text')
						.insert("svg:tspan", ".mouse-focus-label-x")
						.attr("class", "mouse-focus-label-time")
						.attr("dy", "1.5em");
				}
				chart._focuslabelTime.text(this.options.timeFormat(item.time));
			}
		}
	});

	this.on("elechart_summary", function() {
		this.track_info.time = this.track_info.time || 0;

		this._summary
			.append("tottime", L._("Total Time: "), _.formatTime(this.track_info.time))
	});

});
