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
 * Convert SVG Path into Path2D and then update canvas
 */
 export function drawCanvas(ctx, path) {
	path.classed('canvas-path', true);

	ctx.beginPath();
	ctx.moveTo(0, 0);
	let p = new Path2D(path.attr('d'));

	ctx.strokeStyle = path.attr('stroke');
	ctx.fillStyle   = path.attr('fill');
	ctx.lineWidth   = 1.25;
	ctx.globalCompositeOperation = 'source-over';

	// stroke opacity
	ctx.globalAlpha = path.attr('stroke-opacity') || 0.3;
	ctx.stroke(p);

	// fill opacity
	ctx.globalAlpha = path.attr('fill-opacity')   || 0.45;
	ctx.fill(p);

	ctx.globalAlpha = 1;

	ctx.closePath();
}

/**
 * Limit a number between min / max values
 */
 export function clamp(val, range) {
	if (range) return val < range[0] ? range[0] : val > range[1] ? range[1] : val;
	return val;
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


/**
 * Generate a random string
 */
export function randomId() {
	return Math.random().toString(36).substr(2, 9);
}

/**
 * Execute a function foreach element in object
 */
export function each(obj, fn) {
	for (let i in obj) fn(obj[i], i);
}