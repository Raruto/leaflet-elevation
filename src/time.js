import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Elevation } from './control';

Elevation.addInitHook(function() {

	if (!this.options.time) return;

	if (!this.options.timeFormat) {
		this.options.timeFormat = (time) => new Date(time).toLocaleString().replaceAll('/', '-').replaceAll(',', ' ');
	} else if(this.options.timeFormat == 'time'){
		this.options.timeFormat = (time) => new Date(time).toLocaleTimeString();
	} else if(this.options.timeFormat == 'date'){
		this.options.timeFormat = (time) => new Date(time).toLocaleDateString();
	}

	this.on("elechart_change", function(e) {
		let chart = this._chart;
		let item = e.data;

		if (chart._focuslabel) {
			if (!!item.time) {
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

	this.on('elepoint_added', function(e) {
		if (e.point.meta) {
			this._data[e.index].time = e.point.meta.time;
		}
	});

});
