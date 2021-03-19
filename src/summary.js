import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';

export var Summary = L.Class.extend({
	initialize: function(opts, control) {
		this.options = opts;
		this.control = control;

		let summary = this._container = _.create("div", "elevation-summary " + (opts.summary ? opts.summary + "-summary" : ''));
		_.style(summary, 'max-width', opts.width ? opts.width + 'px' : '');
	},

	render: function() {
		return container => container.append(() => this._container);
	},

	reset: function() {
		this._container.innerHTML = '';
	},

	append: function(className, label, value) {
		this._container.innerHTML += `<span class="${className}"><span class="summarylabel">${label}</span><span class="summaryvalue">${value}</span></span>`;
		return this;
	},

	_registerSummary: function(data) {
		for (let i in data) {
			this.append(i, L._(data[i].label), typeof data[i].value !== "function" ? data[i].value : data[i].value(this.control.track_info));
		}
	}

});
