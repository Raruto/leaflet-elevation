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

/*
 * Similar to L.Util.formatNum
 */
export function formatNum(num, dec, sep) {
	return num.toFixed(dec).toString().split(".").join(sep || ".");
}

export function formatTime(t) {
	const SEC = 1000;
	const MIN = SEC * 60;
	const HOUR = MIN * 60;
	const DAY = HOUR * 24;

	let s = '';

	if (t >= DAY) {
		s += Math.floor(t / DAY) + 'd ';
		t = t % DAY;
	}

	if (t >= HOUR) {
		s += Math.floor(t / HOUR) + ':';
		t = t % HOUR;
	}

	if (t >= MIN) {
		s += Math.floor(t / MIN).toString().padStart(2, 0) + "'";
		t = t % MIN;
	}

	if (t >= SEC) {
		s += Math.floor(t / SEC).toString().padStart(2, 0);
		t = t % SEC;
	}

	let msec = Math.round(Math.floor(t) * 1000) / 1000;
	if (msec) s += '.' + msec.toString().replace(/0+$/, '');

  if (!s) s = "0.0";
	s += '"';

	return s;
}

/**
 * Simple GeoJSON data loader.
 */
export function GeoJSONLoader(data, control) {
	if (typeof data === "string") {
		data = JSON.parse(data);
	}
	control = control || this;

	let layer = L.geoJson(data, {
		style: (feature) => {
			let style = L.extend({}, control.options.polyline);
			if (control.options.theme) {
				style.className += ' ' + control.options.theme;
			}
			return style;
		},
		pointToLayer: (feature, latlng) => {
			let marker = L.marker(latlng, { icon: control.options.gpxOptions.marker_options.wptIcons[''] });
			let desc = feature.properties.desc ? feature.properties.desc : '';
			let name = feature.properties.name ? feature.properties.name : '';
			if (name || desc) {
				marker.bindPopup("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : '')).openPopup();
			}
			control.fire('waypoint_added', { point: marker, point_type: 'waypoint', element: latlng });
			return marker;
		},
		onEachFeature: (feature, layer) => {
			if (feature.geometry.type == 'Point') return;

			control.addData(feature, layer);

			control.track_info = L.extend({}, control.track_info, { type: "geojson", name: data.name });
		},
	});

	L.Control.Elevation._d3LazyLoader.then(() => {
		control._fireEvt("eledata_loaded", { data: data, layer: layer, name: control.track_info.name, track_info: control.track_info })
	});

	return layer;
}

/**
 * Simple GPX data loader.
 */
export function GPXLoader(data, control) {
	control = control || this;

	control.options.gpxOptions.polyline_options = L.extend({}, control.options.polyline, control.options.gpxOptions.polyline_options);

	if (control.options.theme) {
		control.options.gpxOptions.polyline_options.className += ' ' + control.options.theme;
	}

	let layer = new L.GPX(data, control.options.gpxOptions);

	// similar to L.GeoJSON.pointToLayer
	layer.on('addpoint', (e) => {
		control.fire("waypoint_added", e);
	});

	// similar to L.GeoJSON.onEachFeature
	layer.on("addline", (e) => {
		control.addData(e.line /*, layer*/ );
		control.track_info = L.extend({}, control.track_info, { type: "gpx", name: layer.get_name() });
	});

	// unlike the L.GeoJSON, L.GPX parsing is async
	layer.once('loaded', (e) => {
		L.Control.Elevation._d3LazyLoader.then(() => {
			control._fireEvt("eledata_loaded", { data: data, layer: layer, name: control.track_info.name, track_info: control.track_info });
		});
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
 * Download data from a remote url.
 */
export function loadFile(url, success) {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();
		xhr.responseType = "text";
		xhr.open('GET', url);
		xhr.onload = () => resolve(xhr.response);
		xhr.onerror = () => reject("Error " + xhr.status + " while fetching remote file: " + url);
		xhr.send();
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

export function style(targetNode, name, value) {
	if (typeof value === "undefined") return L.DomUtil.getStyle(targetNode, name);
	else return targetNode.style.setProperty(name, value);
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
