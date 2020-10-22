import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	this._timeFactor = this.options.timeFactor;

	if (!this.options.timeFormat) {
		this.options.timeFormat = (time) => new Date(time).toLocaleString().replaceAll('/', '-').replaceAll(',', ' ');
	} else if (this.options.timeFormat == 'time') {
		this.options.timeFormat = (time) => new Date(time).toLocaleTimeString();
	} else if (this.options.timeFormat == 'date') {
		this.options.timeFormat = (time) => new Date(time).toLocaleDateString();
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

		let deltaT = Math.abs(currT - prevT);

		this.track_info.time = (this.track_info.time || 0) + deltaT;
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
