import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.time) return;

	if (!this.options.formatTime) {
		this.options.formatTime = (time) => new Date(time).toLocaleString().replaceAll('/', '-').replaceAll(',', ' ');
	}

	this.on("elechart_change", function(e) {
		let chart = this._chart;
		let item = e.data;

		if (chart._focuslabel) {
			if (!!item.t) {
				if (!chart._focuslabelTime || !chart._focuslabelTime.property('isConnected')) {
					chart._focuslabelTime = chart._focuslabel.select('text')
						.insert("svg:tspan", ".mouse-focus-label-x")
						.attr("class", "mouse-focus-label-time")
						.attr("dy", "1.5em");
				}
				chart._focuslabelTime.text(this.options.formatTime(item.t));
				chart._focuslabel.select('.mouse-focus-label-x').attr("dy", "1.5em");
			}
		}

	});

	this.on('elepoint_added', function(e) {
		if (e.point.meta) {
			this._data[e.index].t = e.point.meta.time;
		}
	});

});
