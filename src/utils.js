/**
 * Recursive deep merge objects.
 * Alternative to L.Util.setOptions(this, options).
 */
export function deepMerge(target, ...sources) {
	if (!sources.length) return target;
	const source = sources.shift();
	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) Object.assign(target, {
					[key]: {}
				});
				deepMerge(target[key], source[key]);
			} else {
				Object.assign(target, {
					[key]: source[key]
				});
			}
		}
	}
	return deepMerge(target, ...sources);
}

/**
 * Wait for document load before execute function.
 */
export function deferFunc(f) {
	if (document.readyState !== 'complete') window.addEventListener("load", f, { once: true });
	else f();
}
/**
 * Debounce function to limit events are being fired.
 */
export function debounce(func, wait, context, immediate) {
	var timeout;
	return function() {
		var args = arguments;
		clearTimeout(timeout);
		timeout  = setTimeout(function() {
			timeout = null;
		if (!immediate) func.apply(context, args);
		}, wait);
		if (immediate && !timeout) func.apply(context, args);
	};
}

const SEC  = 1000;
const MIN  = SEC * 60;
const HOUR = MIN * 60;
const DAY  = HOUR * 24;

/**
 * Convert a duration time (millis) to a human readable string (%Dd %H:%M'%S")
 */
export function formatTime(t) {
	let d = Math.floor(t / DAY);
	let h = Math.floor( (t - d * DAY) / HOUR);
	let m = Math.floor( (t - d * DAY - h * HOUR) / MIN);
	let s = Math.round( (t - d * DAY - h * HOUR - m * MIN) / SEC);
	if ( s === 60 ) { m++; s = 0; }
	if ( m === 60 ) { h++; m = 0; }
	if ( h === 24 ) { d++; h = 0; }
	return (d ? d + "d " : '') + h.toString().padStart(2, 0) + ':' + m.toString().padStart(2, 0) + "'" + s.toString().padStart(2, 0) + '"';
}

/**
 * Simple GeoJSON data loader.
 */
export function GeoJSONLoader(data, control) {
	if (typeof data === "string") {
		data = JSON.parse(data);
	}
	control = control || this;

  let distanceMarkers = (
			control.options.distanceMarkers === true
				? { lazy: true }
				: L.extend({ lazy: true }, control.options.distanceMarkers)
	);

	let layer = L.geoJson(data, {
		distanceMarkers: distanceMarkers,
		style: (feature) => {
			let style = L.extend({}, control.options.polyline);
			if (control.options.theme) {
				style.className += ' ' + control.options.theme;
			}
			return style;
		},
		pointToLayer: (feature, latlng) => {
			let marker = L.marker(latlng, { icon: control.options.gpxOptions.marker_options.wptIcons[''] });
			let prop   = feature.properties;
			let desc   = prop.desc ? prop.desc : '';
			let name   = prop.name ? prop.name : '';
			if (name || desc) {
				marker.bindPopup("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : '')).openPopup();
			}
			control._registerCheckPoint({latlng:latlng, label: name}, true);
			control.fire('waypoint_added', { point: marker, point_type: 'waypoint', element: latlng });
			return marker;
		},
		onEachFeature: (feature, layer) => {
			if (feature.geometry && feature.geometry.type == 'Point') return;

			// Standard GeoJSON
			// control.addData(feature, layer);  // NB uses "_addGeoJSONData"

			// Extended GeoJSON
			layer._latlngs.forEach((point, i, data) => {
				// same properties as L.GPX layer
				point.meta = { time: null, ele: null, hr: null, cad: null, atemp: null };
				if("alt" in point) point.meta.ele = point.alt;
				if(feature.properties) {
					let prop = feature.properties;
					if("coordTimes" in prop) point.meta.time = new Date(Date.parse(prop.coordTimes[i]));
					else if("times" in prop) point.meta.time = new Date(Date.parse(prop.times[i]));
					else if("time" in prop) point.meta.time = new Date(Date.parse((typeof prop.time === 'object' ? prop.time[i] : prop.time)));
					if("heartRates" in prop) point.meta.hr = parseInt(prop.heartRates[i]);
					else if("heartRate" in prop) point.meta.hr = parseInt((typeof prop.heartRate === 'object' ? prop.heartRate[i] : prop.heartRate));
					// TODO: cadence, temperature
				}
			});
			control.addData(layer); // NB uses "_addGPXData"

			// Postpone adding the distance markers (lazy: true)
			if(control.options.distanceMarkers && distanceMarkers.lazy) {
        layer.on('add remove', (e) => {
          let path = e.target;
          if (L.DistanceMarkers && path instanceof L.Polyline) {
            path[e.type + 'DistanceMarkers']();
          }
        });
      }

			control.track_info = L.extend({}, control.track_info, { type: "geojson", name: data.name });
		},
	});

	L.Control.Elevation._d3LazyLoader.then(() => {
		control._fireEvt("eledata_loaded", { data: data, layer: layer, name: control.track_info.name, track_info: control.track_info })
	});

	return layer;
}

/**
 * Check DOM element visibility.
 */
export function isDomVisible(elem) {
	return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
}

/**
 * Check object type.
 */
export function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Check DOM element viewport visibility.
 */
export function isVisible(elem) {
	if (!elem) return false;

	let styles = window.getComputedStyle(elem);

	function isVisibleByStyles(elem, styles) {
		return styles.visibility !== 'hidden' && styles.display !== 'none';
	}

	function isAboveOtherElements(elem, styles) {
		let boundingRect = elem.getBoundingClientRect();
		let left = boundingRect.left + 1;
		let right = boundingRect.right - 1;
		let top = boundingRect.top + 1;
		let bottom = boundingRect.bottom - 1;
		let above = true;

		let pointerEvents = elem.style.pointerEvents;

		if (styles['pointer-events'] == 'none') elem.style.pointerEvents = 'auto';

		if (document.elementFromPoint(left, top) !== elem) above = false;
		if (document.elementFromPoint(right, top) !== elem) above = false;

		// Only for completely visible elements
		// if (document.elementFromPoint(left, bottom) !== elem) above = false;
		// if (document.elementFromPoint(right, bottom) !== elem) above = false;

		elem.style.pointerEvents = pointerEvents;

		return above;
	}

	if (!isVisibleByStyles(elem, styles)) return false;
	if (!isAboveOtherElements(elem, styles)) return false;
	return true;
}

/**
 * Check JSON object type.
 */
export function isJSONDoc(doc, lazy) {
	lazy = typeof lazy === "undefined" ? true : lazy;
	if (typeof doc === "string" && lazy) {
		doc = doc.trim();
		return doc.indexOf("{") == 0 || doc.indexOf("[") == 0;
	} else {
		try {
			JSON.parse(doc.toString());
		} catch (e) {
			if (typeof doc === "object" && lazy) return true;
			console.warn(e);
			return false;
		}
		return true;
	}
}

/**
 * Check XML object type.
 */
export function isXMLDoc(doc, lazy) {
	lazy = typeof lazy === "undefined" ? true : lazy;
	if (typeof doc === "string" && lazy) {
		doc = doc.trim();
		return doc.indexOf("<") == 0;
	} else {
		let documentElement = (doc ? doc.ownerDocument || doc : 0).documentElement;
		return documentElement ? documentElement.nodeName !== "HTML" : false;
	}
}

/**
 * Async JS script download.
 */
export function lazyLoader(url, skip, loader) {
	if (skip === false) {
		return Promise.resolve();
	}
	if (loader instanceof Promise) {
		return loader;
	}
	return new Promise((resolve, reject) => {
		let tag = document.createElement("script");
		tag.addEventListener('load', resolve, { once: true });
		tag.src = url;
		document.head.appendChild(tag);
	});
}

/**
 * Generate download data event.
 */
export function saveFile(dataURI, fileName) {
	let a = create('a', '', { href: dataURI, target: '_new', download: fileName || "", style: "display:none;" });
	let b = document.body;
	b.appendChild(a);
	a.click();
	b.removeChild(a);
}

/**
 * Wait for element visible before execute function.
 */
export function waitHolder(elem) {
	return new Promise((resolve, reject) => {
		let ticking = false;
		let scrollFn = () => {
			if (!ticking) {
				L.Util.requestAnimFrame(() => {
					if (isVisible(elem)) {
						window.removeEventListener('scroll', scrollFn);
						resolve();
					}
					ticking = false;
				});
				ticking = true;
			}
		};
		window.addEventListener('scroll', scrollFn);
		if (elem) elem.addEventListener('mouseenter', scrollFn, { once: true });
		scrollFn();
	});
}

/**
 * A little bit safier than L.DomUtil.addClass
 */
export function addClass(targetNode, className) {
	if (targetNode) className.split(" ").every(s => s && L.DomUtil.addClass(targetNode, s));
}

/**
 * A little bit safier than L.DomUtil.removeClass()
 */
export function removeClass(targetNode, className) {
	if (targetNode) className.split(" ").every(s => s && L.DomUtil.removeClass(targetNode, s));
}

export function toggleClass(targetNode, className, conditional) {
	return (conditional ? addClass : removeClass).call(null, targetNode, className)
}

export function replaceClass(targetNode, removeClassName, addClassName) {
  if (removeClassName) removeClass(targetNode, removeClassName);
  if (addClassName) addClass(targetNode, addClassName);
}

export function style(targetNode, name, value) {
	if (typeof value === "undefined") return L.DomUtil.getStyle(targetNode, name);
	else return targetNode.style.setProperty(name, value);
}

export function toggleStyle(targetNode, name, value, conditional) {
  return style(targetNode, name, conditional ? value : '');
}

export function toggleEvent(leafletElement, eventName, handler, conditional) {
	return leafletElement[conditional ? 'on' : 'off'](eventName, handler);
}

/**
 * A little bit shorter than L.DomUtil.create()
 */
export function create(tagName, className, attributes, parent) {
	let elem = L.DomUtil.create(tagName, className || "");
	if (attributes) setAttributes(elem, attributes);
	if (parent) append(parent, elem);
	return elem;
}

/**
 * Same as node.appendChild()
 */
export function append(parent, child) {
	return parent.appendChild(child);
}

/**
 * Same as node.insertAdjacentElement()
 */
export function insert(parent, child, position) {
	return parent.insertAdjacentElement(position, child);
}

/**
 * Loop for node.setAttribute()
 */
export function setAttributes(elem, attrs) {
	for (let k in attrs) { elem.setAttribute(k, attrs[k]); }
}

/**
 * Same as node.querySelector().
 */
export function select(selector, context) {
	return (context || document).querySelector(selector);
}

/**
 * Alias for L.DomEvent.on.
 */
export const on = L.DomEvent.on;

/**
 * Alias for L.DomEvent.off.
 */
export const off = L.DomEvent.off;

/**
 * Alias for L.DomUtil.hasClass.
 */
export const hasClass = L.DomUtil.hasClass;


export function randomId() {
	return Math.random().toString(36).substr(2, 9);
}

export function each(obj, fn) {
	for (let i in obj) fn(obj[i], i);
}
