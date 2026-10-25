const _ = L.Control.Elevation.Utils;

export var Marker = L.Class.extend({

	initialize(options, control) {
		this.options = options;
		this.control = control

		switch(this.options.marker) {
			case 'position-marker':
				// this._marker   = L.circleMarker([0, 0], { pane: 'overlayPane', radius: 6, fillColor: '#fff', fillOpacity:1, color: '#000', weight:1, interactive: false });
				this._marker      = L.marker([0, 0], { icon: this.options.markerIcon, zIndexOffset: 1000000, interactive: false });
			break;
		}

		this._labels = {};

		return this;
	},

	addTo(map) {
		this._map = map;
		switch(this.options.marker) {
			case 'elevation-line':
				this._container = map.getPane('elevationPane').querySelector("svg > g");
				this._container.replaceChildren();
				this._container.setAttribute('class', 'height-focus-group');
			break;
			case 'position-marker': this._marker.addTo(map, { pane: 'overlayPane' }); break;
		}
		return this;
	},

	/**
	 * Update position marker ("leaflet-marker").
	 */
	update(props) {
		if (props) this._props = props;
		else props = this._props;

		if (!props) return;

		if (props.options) this.options = props.options;
		if (!this._map) this.addTo(props.map);

		this._latlng = props.item.latlng;

		switch(this.options.marker) {
			case 'elevation-line':
				if (this._container) {
					let point = this._map.latLngToLayerPoint(this._latlng);
					point     = L.extend({}, props.item, this._map._rotate ? this._map.rotatedPointToMapPanePoint(point) : point);

					// Keep the zero baseline unless the track extends below sea level.
					let yMin = props.yCoordMin || 0;
					let yMax = (this.control._height() / (props.yCoordMax - yMin) * (point[this.options.yAttr] - yMin));

					if (!isFinite(yMax) || isNaN(yMax)) yMax = 0;

					const { x: xCoord, y: yCoord } = point;
					if (!Number.isFinite(xCoord) || !Number.isFinite(yCoord)) return;
					const group = this._container;
					const { theme } = this.options;
					const length = point.y - yMax;
					group.replaceChildren();
					group.setAttribute('class', 'height-focus-group');
					_.create('svg:circle', '', { class: `${theme} height-focus circle-lower`, transform: `translate(${xCoord},${yCoord})`, r: 6, cx: 0, cy: 0 }, group);
					_.create('svg:line', '', { class: `${theme} height-focus line`, x1: xCoord, x2: xCoord, y1: yCoord, y2: length }, group);
					const text = _.create('svg:text', '', { class: `${theme} height-focus-label`, x: xCoord + 5, y: length, 'pointer-events': 'none' }, group);
					Object.values(this._labels).sort((a, b) => a.order - b.order).forEach(label => {
						_.create('svg:tspan', '', { class: 'height-focus-' + label.name, dy: '1.5em' }, text).textContent =
							typeof label.value === 'function' ? label.value(point) : label.value;
					});
					if (text.firstChild) text.firstChild.setAttribute('dy', text.children.length > 1 ? '-1.5em' : '0em');
					for (const span of text.children) span.setAttribute('x', xCoord + 5);
				}
			break;
			case 'position-marker':
				_.removeClass(this._marker.getElement(), 'leaflet-hidden');
				this._marker.setLatLng(this._latlng);
			break;
		}
	},

	/*
	 * Hides the position/height indicator marker drawn onto the map
	 */
	remove() {
		this._props = null;
		switch(this.options.marker) {
			case 'elevation-line':  this._container && this._container.classList.add("leaflet-hidden"); break;
			case 'position-marker': _.addClass(this._marker.getElement(), 'leaflet-hidden');            break;
		}
	},

	getLatLng() {
		return this._latlng;
	},

	_registerTooltip(props) {
		this._labels[props.name] = props;
	}

});
