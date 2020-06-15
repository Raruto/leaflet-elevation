import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';

export var Summary = L.Class.extend({
	initialize: function(options) {
		let opts = this.options = options;

		let summary = this._summary = _.create("div", "elevation-summary " + (this.options.summary ? this.options.summary + "-summary" : ''), {
			style: 'max-width:' + this.options.width + 'px'
		});
	},

	render: function() {
		return container => container.append(() => this._summary);
	},

	reset: function(){
		this._summary.innerHTML = '';
	}
});
