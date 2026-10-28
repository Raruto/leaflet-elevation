/*
 * Copyright (c) 2022, GPL-3.0+ Project, Raruto
 *
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or (at your
 *  option) any later version.
 *
 *  This file is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see .
 *
 * This file incorporates work covered by the following copyright and
 * permission notice:
 * 
 *     Copyright (c) 2017 Goker Tanrisever
 *
 *     Permission to use, copy, modify, and/or distribute this software
 *     for any purpose with or without fee is hereby granted, provided
 *     that the above copyright notice and this permission notice appear
 *     in all copies.
 *
 *     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
 *     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
 *     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
 *     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
 *     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 *     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 *     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 *     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

L.Control.Ruler = L.Control.extend({
	options: {
		position: 'topright',
		circleMarker: {
			color: 'red',
			radius: 2,
		},
		lineStyle: {
			color: 'red',
			dashArray: '1,6'
		},
		lengthUnit: {
			display: 'km',
			decimal: 2,
			factor: 0.001, // meters -> kilometers
			label: 'Distance:'
		},
		angleUnit: {
			display: '&deg;',
			decimal: 2,
			factor: 360,
			label: 'Bearing:'
		}
	},
	initialize(options) {
		L.Util.setOptions(this, options);
		this._layers = new L.LayerGroup();
		this._enabled = false;
	},
	onAdd(map) {
		this._defaultCursor = map._container.style.cursor;
		this._map = map;
		let container = L.DomUtil.create('div', 'leaflet-bar');
		container.classList.add('leaflet-ruler');
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.on(container, 'click', this._toggleMeasure, this);
		return this._container = container;
	},
	onRemove() {
		L.DomEvent.off(this._container, 'click', this._toggleMeasure, this);
	},
	_attachMouseEvents() {
		let map = this._map;
		map.doubleClickZoom.disable();
		L.DomEvent.on(map._container, 'keydown', this._escape, this);
		L.DomEvent.on(map._container, 'dblclick', this._closePath, this);
		map._container.style.cursor = 'crosshair';
		map.on('click', this._addPoint, this);
		map.on(L.version.startsWith('2') ? 'pointermove' : 'mousemove', this._moving, this);
	},
	_removeMouseEvents() {
		let map = this._map;
		map.doubleClickZoom.enable();
		L.DomEvent.off(map._container, 'keydown', this._escape, this);
		L.DomEvent.off(map._container, 'dblclick', this._closePath, this);
		map._container.style.cursor = this._defaultCursor;
		map.off('click', this._addPoint, this);
		map.off(L.version.startsWith('2') ? 'pointermove' : 'mousemove', this._moving, this);
	},
	_disable() {
		this._enabled = false;
		this._container.classList.remove("leaflet-ruler-clicked");
		this._layers.remove().clearLayers();
		this._latlngs = [];
		this._totalLength = 0;
		this._removeMouseEvents();
	},
	_enable() {
		this._enabled = true;
		this._container.classList.add("leaflet-ruler-clicked");
		this._circles = new L.FeatureGroup().addTo(this._layers);
		this._polyline = new L.Polyline([], this.options.lineStyle).addTo(this._layers);
		this._layers.addTo(this._map);
		this._latlngs = [];
		this._totalLength = 0;
		this._attachMouseEvents();
	},
	_toggleMeasure() {
		this._enabled ? this._disable() : this._enable();
	},
	_drawTooltip(latlng, layer, incremental) {
		let lastClick = this._latlngs[this._latlngs.length - 1] ?? latlng;
		let bearing = this._calculateBearing(lastClick, latlng);
		let distance = lastClick.distanceTo(latlng) * this.options.lengthUnit.factor;
		let accumulated = this._totalLength + distance;
		let totalLength = accumulated.toFixed(this.options.lengthUnit.decimal);
		let plusLength = incremental ? '<br><div class="plus-length">(+' + distance.toFixed(this.options.lengthUnit.decimal) + ')</div>' : '';
		this._totalLength = incremental ? this._totalLength : accumulated;
		if (!layer.getTooltip()) layer.bindTooltip('', incremental ? { direction: "auto", sticky: true, offset: new L.Point(0, -40), className: 'moving-tooltip' } : { permanent: true, className: 'result-tooltip' }).openTooltip();
		layer.setLatLng(latlng).setTooltipContent('<b>' + this.options.angleUnit.label + '</b>&nbsp;' + bearing.toFixed(this.options.angleUnit.decimal) + '&nbsp;' + this.options.angleUnit.display + '<br><b>' + this.options.lengthUnit.label + '</b>&nbsp;' + totalLength + '&nbsp;' + this.options.lengthUnit.display + plusLength);
	},
	_addPoint(e) {
		let latlng = e.latlng || e;
		let point = new L.CircleMarker(latlng, this.options.circleMarker).addTo(this._circles);
		this._polyline.addLatLng(latlng);
		if(this._latlngs.length && !latlng.equals(this._latlngs[this._latlngs.length - 1])){
			this._drawTooltip(latlng, point, false);
		}
		this._latlngs.push(latlng);
	},
	_moving(e) {
		if (this._latlngs.length) {
			let lastCLick = this._latlngs[this._latlngs.length - 1];
			if (!this._tempLine) this._tempLine = new L.Polyline([], this.options.lineStyle).addTo(this._map);
			if (!this._tempPoint) this._tempPoint = new L.CircleMarker(e.latlng, this.options.circleMarker).addTo(this._map);
			this._tempLine.setLatLngs([lastCLick, e.latlng]);
			this._drawTooltip(e.latlng, this._tempPoint, true);
			L.DomEvent.off(this._container, 'click', this._toggleMeasure, this);
		}
	},
	_escape(e) {
		if (e.keyCode === 27) {
			if (this._latlngs.length) {
				this._closePath();
			} else {
				this._enabled = true;
				this._toggleMeasure();
			}
		}
	},
	_calculateBearing(start, end) {
		const toRad = Math.PI / 180;
		const toDeg = (this.options.angleUnit.factor / 2) / Math.PI;
		let y = Math.sin((end.lng - start.lng) * toRad) * Math.cos(end.lat * toRad);
		let x = Math.cos(start.lat * toRad) * Math.sin(end.lat * toRad) - Math.sin(start.lat * toRad) * Math.cos(end.lat * toRad) * Math.cos((end.lng - start.lng) * toRad);
		return (Math.atan2(y, x) * toDeg + this.options.angleUnit.factor) % this.options.angleUnit.factor;
	},
	_closePath() {
		if (this._tempLine) {
			this._tempLine.remove();
			this._tempLine = null;
		}
		if (this._tempPoint) {
			this._tempPoint.remove();
			this._tempLine = null;
		}
		if (this._latlngs.length <= 1) {
			this._circles.remove();
		}
		this._enabled = false;
		L.DomEvent.on(this._container, 'click', this._toggleMeasure, this);
		this._toggleMeasure();
	},
});

// backcomps for leaflet v1
L.control = L.control || {};
L.control.ruler = function (options) {
	return new L.Control.Ruler(options);
};  