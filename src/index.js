/*
 * Copyright (c) 2019, GPL-3.0+ Project, Raruto
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
 *     Copyright (c) 2013-2016, MIT License, Felix “MrMufflon” Bache
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

import 'leaflet-i18n';
import * as _ from './utils';
import * as D3 from './components';
import { Chart } from './chart';
import { Elevation } from './control';
import './distance';
import './time';
import './altitude';
import './slope';
import './speed';
import './acceleration';

Elevation.Utils = _;
Elevation.Components = D3;
Elevation.Chart = Chart;

/* Temporary fix for empty values evaluated as false (leaflet-i18n v0.3.1) */
(function(){
	let proto = L.i18n.bind({});
	L.i18n = L._ = (string, data) => {
		if (L.locale && L.locales[L.locale] && L.locales[L.locale][string] == "") {
			L.locales[L.locale][string] = "\u200B";
		}
		return proto.call(null, string, data);
	};
})();

// Alias deprecated functions
 Elevation.addInitHook(function() {
	this.enableDragging      = this.enableBrush;
	this.disableDragging     = this.disableBrush;
	this.loadChart           = this.addTo;
	this.loadData            = this.load;
	this.loadGPX             = this.load;
	this.loadGeoJSON         = this.load;
	this.loadXML             = this.load;
	this.loadFile            = this.load;
	this._addGPXData         = this._addGeoJSONData;
	this._registerFocusLabel = this._registerTooltip;
});

L.control.elevation = (options) => new Elevation(options);
