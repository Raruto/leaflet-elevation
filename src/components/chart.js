const _ = L.Control.Elevation.Utils;

export var Chart = L.Control.Elevation.Chart = L.Evented.extend({

	initialize(opts, control) {
		this.options = opts;
		this.control = control;
		this._data = control._data || [];
		this._props = { scales: {}, paths: {}, areas: {}, grids: {}, axes: {}, legendItems: {}, tooltipItems: {} };
		this._scales = {};
		this._domains = {};
		this._ranges = {};
		this._paths = {};
		this._brushEnabled = opts.dragging;
		this._zoomEnabled = opts.zooming;
		this.__xTicks = opts.xTicks;
		this.__yTicks = opts.yTicks;
		this._transform = { k: 1, x: 0 };
		const { width, height, margins = {}, ruler, preferCanvas } = opts;
		const svg = _.create('svg:svg', '', { class: 'background' });
		const defs = _.create('svg:defs', '', {}, svg);
		const g = _.create('svg:g', '', {}, svg);
		const panes = {};
		for (const name of ['grid', 'area', 'axis', 'point', 'brush', 'tooltip', 'ruler', 'legend']) panes[name] = _.create('svg:g', '', { class: name }, g);
		panes.tooltip.setAttribute('display', 'none');
		const mask = _.create('svg:mask', '', { id: 'elevation-clipper-' + _.randomId(), 'fill-opacity': 1 }, panes.area);
		const maskRect = _.create('svg:rect', '', { class: 'zoom', fill: 'white' }, mask);
		const foreignObject = _.create('svg:foreignObject', '', { mask: `url(#${mask.id})` }, panes.area);
		const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		canvas.className = 'canvas-plot';
		foreignObject.appendChild(canvas);
		const context = canvas.getContext('2d');
		const webkitCanvas = preferCanvas && /Mac|iPod|iPhone|iPad/.test(navigator.platform) &&
			/AppleWebkit/i.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
		const canvasImage = webkitCanvas ? _.create('svg:image', '', { mask: `url(#${mask.id})`, 'pointer-events': 'none' }, panes.area) : null;
		if (canvasImage) foreignObject.remove();
		const overlay = _.create('svg:rect', '', { class: 'overlay', fill: 'none', 'pointer-events': 'all' }, panes.brush);
		const selection = _.create('svg:rect', '', { class: 'selection', fill: '#777', 'fill-opacity': 0.3, stroke: '#fff', display: 'none' }, panes.brush);
		for (const edge of ['w', 'e']) _.create('svg:rect', '', { class: `handle handle--${edge}`, fill: 'none', 'pointer-events': 'all', display: 'none', cursor: 'ew-resize' }, panes.brush);
		const chart = this._chart = { svg, g, panes, utils: { defs, mask, canvas, context }, pane: name => panes[name] || (panes[name] = _.create('svg:g', '', { class: name }, g)) };
		chart.get = name => chart.utils[name];
		// ponytail: Safari encodes one PNG per redraw; use a separate HTML canvas layer if encoding becomes a bottleneck.
		chart._renderCanvas = () => { if (canvasImage) canvasImage.setAttribute('href', canvas.toDataURL()); };
		chart._resize = ({ width, height, margins = {}, ruler }) => {
			const w = width - margins.left - margins.right, h = height - margins.top - margins.bottom;
			_.setAttributes(svg, { width, height, viewBox: `0 0 ${width} ${height}` });
			g.setAttribute('transform', `translate(${margins.left},${margins.top})`);
			_.setAttributes(maskRect, { width: w, height: h, x: 0, y: 0 });
			_.setAttributes(foreignObject, { width: w, height: h });
			_.setAttributes(canvas, { width: w, height: h });
			if (canvasImage) { _.setAttributes(canvasImage, { width: w, height: h }); canvasImage.removeAttribute('href'); }
			_.setAttributes(overlay, { x: 0, y: 0, width: w, height: h });
			selection.setAttribute('display', 'none');
			for (const handle of panes.brush.querySelectorAll('.handle')) handle.setAttribute('display', 'none');
			if (ruler) {
				const group = panes.ruler;
				group.replaceChildren();
				group.dataset.y = h;
				group.setAttribute('transform', `translate(0,${h})`);
				_.create('svg:rect', '', { class: 'horizontal-drag-rect', x: 0, y: -8, width: w, height: 8, fill: 'none', 'pointer-events': 'all' }, group);
				_.create('svg:line', '', { class: 'horizontal-drag-line', x1: 0, x2: w }, group);
				_.create('svg:text', '', { class: 'horizontal-drag-label', 'text-anchor': 'end', x: w - 8, y: -8 }, group);
				_.create('svg:path', '', { class: 'horizontal-drag-symbol', d: 'M0,-6L5,3L-5,3Z', transform: `translate(${w + 7},0) rotate(-90)` }, group);
			}
			chart._width = w;
			chart._height = h;
			svg.dispatchEvent(new CustomEvent('resize', { detail: { width: w, height: h } }));
		};
		chart._resize({ width, height, margins, ruler });
		this._container = chart.svg;
		for (const name of ['grid', 'area', 'point', 'axis', 'legend', 'tooltip', 'ruler']) this['_' + name] = chart.pane(name);
		this._mask = chart.get('mask');
		this._context = chart.get('context');
		this._registerAxisScale({ axis: 'x', position: 'bottom', attr: opts.xAttr, min: opts.xAxisMin, max: opts.xAxisMax, name: 'distance' });
		this._registerAxisScale({ axis: 'y', position: 'left', attr: opts.yAttr, min: opts.yAxisMin, max: opts.yAxisMax, name: 'altitude' });
		this._x = this._scales.distance;
		this._y = this._scales.altitude;
		this._maskGaps = [];
		control.on('eletrack_added', ({ index }) => {
			this._maskGaps.push(index);
			control.once('elepoint_added', ({ index }) => this._maskGaps.push(index));
		});
		const brush = panes.brush;
		const focus = event => {
			if (!this.options.detached) event.stopPropagation();
			if (!this._data.length) return;
			const xCoord = _.clamp(_.pointer(event, this._area)[0], [0, this._width()]);
			this.fire('mouse_move', { item: this._data[this._findIndexForXCoord(xCoord)], xCoord });
		};
		const rulerLabel = () => {
			const y = +this._ruler.dataset.y;
			if (y <= 0 || y >= this._height()) this._ruler.querySelector('text').textContent = '';
			this._hideDiagramIndicator();
		};
		brush.style.touchAction = 'none';
		this._ruler.style.touchAction = 'none';
		brush.addEventListener('pointerenter', () => this.fire('mouse_enter'));
		brush.addEventListener('pointerleave', () => { if (!this._gesture) this.fire('mouse_out'); });
		brush.addEventListener('pointermove', event => { if (!this._gesture) focus(event); });
		brush.addEventListener('mousemove', event => {
			if (!this.options.detached) event.stopPropagation();
		});
		svg.addEventListener('pointerdown', event => {
			if (this._gesture || !event.isPrimary) return;
			const [x] = _.pointer(event, this._area);
			let type;
			if (this._ruler.contains(event.target) && this.options.ruler && event.button === 0) type = 'ruler';
			else if ((event.shiftKey || event.button === 1) && this._zoomEnabled) type = 'pan';
			else if (brush.contains(event.target) && !event.shiftKey && event.button === 0 && this._brushEnabled) {
				type = event.target.classList.contains('handle--w') ? 'west' :
					event.target.classList.contains('handle--e') ? 'east' :
					event.target.classList.contains('selection') ? 'move' : 'brush';
			}
			if (!type) return;
			event.preventDefault();
			event.stopPropagation();
			svg.setPointerCapture(event.pointerId);
			this._gesture = { type, id: event.pointerId, start: x, selection: this._selection?.slice(), transform: { ...this._transform } };
			if (type === 'ruler') rulerLabel();
			else if (type === 'pan') svg.style.cursor = 'grabbing';
			else {
				this.fire('mouse_enter');
				if (type === 'brush') this._setSelection([x, x]);
				focus(event);
			}
		});
		svg.addEventListener('pointermove', event => {
			const gesture = this._gesture;
			if (!gesture || gesture.id !== event.pointerId) return;
			event.preventDefault();
			const [rawX, rawY] = _.pointer(event, this._area);
			const x = _.clamp(rawX, [0, this._width()]);
			if (gesture.type === 'pan') {
				this._setZoom(gesture.transform.k, gesture.transform.x + rawX - gesture.start);
				this._hideDiagramIndicator();
			} else if (gesture.type === 'ruler') {
				const y = _.clamp(rawY, [0, this._height()]);
				this._ruler.dataset.y = y;
				this._ruler.setAttribute('transform', `translate(0,${y})`);
				this._ruler.classList.toggle('active', y < this._height());
				this._ruler.querySelector('text').textContent = this._y.invert(y).toFixed(0) + ' ' + (this.options.imperial ? 'ft' : 'm');
				const groups = [];
				if (rawY > 0 && rawY < this._height()) {
					const altitude = this._y.invert(rawY);
					let group;
					for (const item of this._data) {
						if (item[this.options.yAttr] >= altitude) {
							if (!group) groups.push(group = []);
							group.push(item.latlng);
						} else group = null;
					}
				}
				this.fire('ruler_filter', { coords: groups });
			} else {
				let selection;
				if (gesture.type === 'move') {
					const delta = _.clamp(x - gesture.start, [-gesture.selection[0], this._width() - gesture.selection[1]]);
					selection = gesture.selection.map(value => value + delta);
				} else if (gesture.type === 'west') selection = [x, gesture.selection[1]];
				else if (gesture.type === 'east') selection = [gesture.selection[0], x];
				else selection = [_.clamp(gesture.start, [0, this._width()]), x];
				this._setSelection(selection);
			}
		});
		const end = event => {
			const gesture = this._gesture;
			if (!gesture || gesture.id !== event.pointerId) return;
			this._gesture = null;
			svg.style.cursor = '';
			if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
			if (gesture.type === 'ruler') rulerLabel();
			else if (gesture.type !== 'pan') {
				if (event.type === 'pointercancel' || !this._selection || this._selection[1] - this._selection[0] < 1) this._resetDrag();
				else if (this._data.length) this.fire('dragged', {
					dragstart: this._data[this._findIndexForXCoord(this._selection[0])],
					dragend: this._data[this._findIndexForXCoord(this._selection[1])],
				});
			}
			if (event.pointerType === 'touch') this.fire('mouse_out');
		};
		for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(name, end);
		const zoomAt = (event, factor) => {
			if (!this._zoomEnabled || !event.shiftKey) return;
			event.preventDefault();
			const x = _.pointer(event, this._area)[0];
			const k = _.clamp(this._transform.k * factor, [1, 10]);
			this._setZoom(k, x - (x - this._transform.x) * k / this._transform.k);
		};
		svg.addEventListener('wheel', event => zoomAt(event, 2 ** (-event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))), { passive: false });
		svg.addEventListener('dblclick', event => zoomAt(event, 2));
		svg.addEventListener('legend_clicked', ({ detail: { path, name, legend, enabled } }) => {
			if (!path) return;
			this._togglePath(name, !enabled);
			this.fire('elepath_toggle', { path, name, legend, enabled });
		});
	},

	render() {
		return container => container.appendChild(this._container);
	},

	clear() {
		this._resetDrag();
		this._hideDiagramIndicator();
		this._transform = { k: 1, x: 0 };
		this._container.classList.remove('zoomed');
		this._point.removeAttribute('mask');
		this._point.replaceChildren();
		for (const path of Object.values(this._paths)) path.setAttribute('d', 'M0 0');
		this._context.clearRect(0, 0, this._width(), this._height());
		this._chart._renderCanvas();
		this._mask.querySelectorAll('.gap').forEach(node => node.remove());
		this._maskGaps = [];
	},

	_hasActiveLayers() {
		return Object.values(this._paths).some(path => !path.classList.contains('leaflet-hidden'));
	},

	_setSelection(values) {
		this._selection = values.map(x => _.clamp(x, [0, this._width()])).sort((a, b) => a - b);
		const [start, end] = this._selection;
		_.setAttributes(this._chart.panes.brush.querySelector('.selection'), {
			x: start, y: 0, width: end - start, height: this._height(), display: 'inline', cursor: 'move',
		});
		for (const edge of ['w', 'e']) _.setAttributes(this._chart.panes.brush.querySelector('.handle--' + edge), {
			x: (edge === 'w' ? start : end) - 3, y: 0, width: 6, height: this._height(), display: 'inline',
		});
	},

	_setZoom(k, x) {
		if (!Number.isFinite(k) || !Number.isFinite(x) || k <= 0) throw new Error('Invalid chart zoom');
		k = _.clamp(k, [1, 10]);
		this._transform = { k, x: _.clamp(x, [this._width() * (1 - k), 0]) };
		this._container.classList.toggle('zoomed', k !== 1);
		if (k !== 1) this._point.setAttribute('mask', `url(#${this._mask.id})`);
		else this._point.removeAttribute('mask');
		this._resetDrag();
		this._updateScale();
		this.fire('zoom');
	},

	_registerAreaPath(props) {
		props = { xAttr: this.options.xAttr, yAttr: this.options.yAttr, preferCanvas: this.options.preferCanvas, ...props };
		const { name, color, strokeColor, strokeOpacity, fillOpacity, className = '' } = props;
		const path = this._paths[name] = _.create('svg:path', '', {
			class: `${name || ''} ${className}`,
			fill: color || '#3366CC', stroke: strokeColor || '#000',
			'stroke-opacity': strokeOpacity ?? 1, 'fill-opacity': fillOpacity ?? 0.8,
		});
		path.style.pointerEvents = 'none';
		this._props.areas[props.name] = props;
		if (this.options.legend) this._props.legendItems[props.name] = { ...props, path: this._paths[props.name] };
	},

	_registerAxisGrid(props) {
		this._props.grids[props.name || props.axis] = { ...props };
	},

	_registerAxisScale(props) {
		props = { ...props };
		const alias = props.scale;
		if (alias === 'y') props.scale = this._y;
		else if (alias === 'x') props.scale = this._x;
		if (typeof this._scales[props.name] === 'function') props.scale = this._scales[props.name];
		else if (typeof props.scale !== 'function') {
			const scale = { data: this._data, forceBounds: this.options.forceAxisBounds, ...props.scale };
			scale.attr = scale.attr || props.name;
			const { min, max, attr, name, forceBounds, scale: domainScale } = { forceBounds: scale.forceBounds, ...props };
			const key = (domainScale && domainScale.attr) || attr || name;
			this._domains[props.name] = data => {
				let low = Infinity, high = -Infinity;
				for (const point of data || []) {
					const value = point[key];
					if (value == null || !Number.isFinite(+value)) continue;
					low = Math.min(low, +value);
					high = Math.max(high, +value);
				}
				if (low === Infinity) [low, high] = [0, 1];
				if (min !== undefined && (min < low || forceBounds)) low = +min;
				if (max !== undefined && (max > high || forceBounds)) high = +max;
				return [low, high];
			};
			this._ranges[props.name] = (width, height) => props.axis === 'x' ? [0, width] : [height, 0];
			scale.range = scale.range || this._ranges[props.name](this._width(), this._height());
			scale.domain = scale.domain || this._domains[props.name](this._data);
			this._props.scales[props.name] = scale;
			const Scale = function({ domain, range }) {
				let bounds = domain;
				let pixels = range;
				const interpolate = (value, from, to) => {
					const fraction = from[1] === from[0] ? 0.5 : (value - from[0]) / (from[1] - from[0]);
					return to[0] + fraction * (to[1] - to[0]);
				};
				const scale = value => value == null ? undefined : interpolate(+value, bounds, pixels);
				scale.invert = value => interpolate(+value, pixels, bounds);
				scale.domain = function(value) {
					if (!arguments.length) return bounds.slice();
					bounds = value.map(Number);
					return scale;
				};
				scale.range = function(value) {
					if (!arguments.length) return pixels.slice();
					pixels = value.map(Number);
					return scale;
				};
				scale.copy = () => Scale({ domain: bounds.slice(), range: pixels.slice() });
				scale.ticks = (count = 10) => {
					const [low, high] = [Math.min(...bounds), Math.max(...bounds)];
					if (!(count > 0) || !Number.isFinite(low + high)) return [];
					if (low === high) return [low];
					const raw = (high - low) / count;
					const power = 10 ** Math.floor(Math.log10(raw));
					const error = raw / power;
					const step = power * (error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1);
					const first = Math.ceil(low / step), last = Math.floor(high / step);
					const values = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => +( (first + i) * step).toPrecision(14));
					return bounds[0] > bounds[1] ? values.reverse() : values;
				};
				return scale;
			};
			props.scale = this._scales[props.name] = Scale(scale);
		} else if (alias === 'x' || alias === 'y') {
			// Aliases share the original scale, including its zoomed domain.
			this._scales[props.name] = props.scale;
		}
		if (!props.ticks) props.ticks = (props.axis === 'x' ? this._xTicks : this._yTicks).bind(this);
		this._props.axes[props.name] = props;
		if (props.name === this.options.yScale) this._y = props.scale;
		if (props.name === this.options.xScale) this._x = props.scale;
		return props.scale;
	},

	_registerCheckPoint(point) {
		if (!this._data.length) return;
		const { xAttr, yAttr } = this.options;
		let item, x;
		if (point.latlng) {
			item = this._data[this._findIndexForLatLng(point.latlng)];
			x = this._x(item[xAttr]);
		} else if (!isNaN(point[xAttr])) {
			x = this._x(point[xAttr]);
			item = this._data[this._findIndexForXCoord(x)];
		}
		if (!item) return;
		const y = this._y(item[yAttr]);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		if (!point.item?.isConnected) {
			point.position = point.position || 'bottom';
			point.item = _.create('svg:g', '', {}, this._point);
			_.create('svg:line', '', { x1: 0, y1: 0, style: 'stroke: rgb(51, 51, 51); stroke-width: 0.5; stroke-dasharray: 2, 2;' }, point.item);
			_.create('svg:circle', '', { class: 'height-focus circle-lower', r: 3 }, point.item);
			if (point.label) _.create('svg:text', '', { dx: '4px', dy: '-4px' }, point.item);
		}
		_.setAttributes(point.item, { class: 'point ' + point.position, transform: `translate(${x},${y})`, 'data-y': y });
		_.setAttributes(point.item.querySelector('line'), { y2: ({ top: -y, bottom: this._height() - y })[point.position],
			x2: ({ left: -x, right: this._width() - x })[point.position] || 0 });
		if (point.label) point.item.querySelector('text').textContent = point.label;
	},

	_registerTooltip(props) {
		props.order = props.order ?? 1000;
		this._props.tooltipItems[props.name] = props;
	},

	_updateArea() {
		this._context.clearRect(0, 0, this._width(), this._height());
		for (const name in this._paths) {
			const path = this._paths[name], area = this._props.areas[name];
			if (path.classList.contains('leaflet-hidden')) continue;
			const { xAttr, yAttr, interpolation = 'curveLinear' } = { interpolation: this.options.interpolation, ...area };
			const scaleX = this._scales[area.scaleX], scaleY = this._scales[area.scaleY];
			if (!['curveLinear', 'curveStep', 'curveStepBefore', 'curveStepAfter'].includes(interpolation)) {
				throw new Error(`Unsupported interpolation "${interpolation}". Use curveLinear, curveStep, curveStepBefore or curveStepAfter.`);
			}
			let outline = '';
			if (this._data.length) {
				const points = this._data.map(d => [d.xDiagCoord = scaleX(d[xAttr]), scaleY(d[yAttr])]);
				outline = `M${points[0]}`;
				for (let i = 1; i < points.length; i++) {
					const [x, y] = points[i], [previousX] = points[i - 1];
					if (interpolation === 'curveStepBefore') outline += `V${y}H${x}`;
					else if (interpolation === 'curveStepAfter') outline += `H${x}V${y}`;
					else if (interpolation === 'curveStep') outline += `H${(previousX + x) / 2}V${y}H${x}`;
					else outline += `L${x},${y}`;
				}
				outline += `L${points.at(-1)[0]},${this._height()}L${points[0][0]},${this._height()}Z`;
			}
			path.setAttribute('d', outline);
			if (this.options.preferCanvas) _.drawCanvas(this._context, path);
			else this._area.appendChild(path);
		}
		this._chart._renderCanvas();
	},

	update(props) {
		if (props?.data) this._data = props.data;
		if (props?.options) this.options = props.options;
		this.options.xTicks = this._xTicks();
		this.options.yTicks = this._yTicks();
		this._updateScale();
		this._grid.replaceChildren();
		this._axis.replaceChildren();
		const entries = [
			...Object.entries(this._props.grids).map(([name, props]) => [name, { tickFormat: '', ...props, type: 'grid' }, this._grid]),
			...Object.entries(this._props.axes).map(([name, props]) => [name, props, this._axis]),
		];
		for (const [key, props, parent] of entries) {
			if (this.options[key] === false || this.options[key] === 'summary') continue;
			const {
				type = 'axis', tickSize = 6, tickPadding = 3, position, height, width,
				axis, ticks, tickFormat, label, labelX, labelY, name = '', onAxisMount,
			} = { width: this._width(), height: this._height(), ...props };
			const scale = props.scale === 'x' ? this._x : props.scale === 'y' ? this._y : props.scale;
			const horizontal = axis === 'x';
			const sign = position === 'top' || position === 'left' ? -1 : 1;
			const size = type === 'grid' ? horizontal ? -height : -width : tickSize;
			const group = _.create('svg:g', '', {
				class: [axis, type, position, name].join(' '),
				transform: `translate(${position === 'right' ? width : 0},${position === 'bottom' ? height : 0})`,
				fill: 'none', 'font-size': 10, 'font-family': 'sans-serif',
				'text-anchor': horizontal ? 'middle' : sign < 0 ? 'end' : 'start',
			}, parent);
			const range = scale.range();
			_.create('svg:path', '', { class: 'domain', stroke: 'currentColor',
				d: horizontal ? `M${range[0]},${sign * 6}V0.5H${range[1]}V${sign * 6}` : `M${sign * 6},${range[0]}H0.5V${range[1]}H${sign * 6}` }, group);
			const values = scale.ticks(typeof ticks === 'function' ? ticks() : ticks);
			const step = values.length > 1 ? Math.abs(values[1] - values[0]) : 1;
			const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.min(20, Math.max(0, -Math.floor(Math.log10(step)))) });
			for (const value of values) {
				const coordinate = scale(value) + 0.5;
				const tick = _.create('svg:g', '', { class: 'tick', opacity: 1, transform: horizontal ? `translate(${coordinate},0)` : `translate(0,${coordinate})` }, group);
				_.create('svg:line', '', { stroke: 'currentColor', [horizontal ? 'y2' : 'x2']: sign * size }, tick);
				const text = _.create('svg:text', '', { fill: 'currentColor', [horizontal ? 'y' : 'x']: sign * (Math.max(0, size) + tickPadding),
					dy: horizontal ? sign < 0 ? '0em' : '0.71em' : '0.32em' }, tick);
				text.textContent = typeof tickFormat === 'function' ? tickFormat(value) : tickFormat ?? format.format(value);
			}
			if (label) _.create('svg:text', '', {
				x: typeof labelX === 'function' ? labelX() : labelX,
				y: typeof labelY === 'function' ? labelY() : labelY,
			}, group).textContent = label;
			if (onAxisMount) onAxisMount(group);
		}
		this._axis.querySelectorAll('.y.axis.right').forEach((axis, i) => {
			axis.setAttribute('transform', `translate(${this._width() + i * 40},0)`);
			if (i > 0) {
				axis.querySelector(':scope > path').setAttribute('opacity', 0.25);
				axis.querySelectorAll(':scope > .tick line').forEach(line => line.setAttribute('opacity', 0.75));
			}
		});
		const margins = {
			bottom: 60 + this._axis.querySelectorAll('.x.axis.bottom').length * 2,
			left: 10 + this._axis.querySelectorAll('.y.axis.left').length * 30,
			right: 40 + this._axis.querySelectorAll('.y.axis.right').length * 30,
		};
		let updated = false;
		for (const side in margins) {
			if (this._axis.querySelector(side === 'bottom' ? '.x.axis.bottom' : '.y.axis.' + side) && this.options.margins[side] < margins[side]) {
				this.options.margins[side] = margins[side];
				updated = true;
			}
		}
		if (updated) this.fire('margins_updated');

		const xAxesB = this._axis.querySelectorAll('.x.axis.bottom').length;
		const items = Object.keys(this._paths), n = items.length;
		let positions = Array.from({ length: Math.floor(n / 2) }, (_, i) => (i + 1) * 2 - (1 - Math.sign(n % 2)));
		positions = positions.slice().reverse().map(value => -value).concat(n % 2 ? [0] : [], positions);
		this._legend.replaceChildren();
		for (const legend of Object.values(this._props.legendItems)) {
			const { name, label, width, height, margins = {}, color, path, className = '' } = {
				width: this._width(), height: this._height(), margins: this.options.margins, ...legend,
			};
			const group = _.create('svg:g', '', { class: 'legend-item legend-' + name.toLowerCase(), 'data-name': name, role: 'button', tabindex: 0 }, this._legend);
			const toggle = () => group.ownerSVGElement.dispatchEvent(new CustomEvent('legend_clicked', {
				detail: { path, name, legend: group, enabled: !path.classList.contains('leaflet-hidden') },
			}));
			group.addEventListener('click', toggle);
			group.addEventListener('keydown', event => {
				if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
			});
			_.create('svg:rect', '', { x: width / 2 - 50, y: height + margins.bottom / 2, width: 50, height: 10,
				fill: color, stroke: '#000', 'stroke-opacity': 0.5, 'fill-opacity': 0.25, class: className }, group);
			const text = _.create('svg:text', '', { x: width / 2 + 5, y: height + margins.bottom / 2, 'font-size': 10, 'font-weight': 700, dy: '0.75em' }, group);
			text.textContent = L._(label || name);
		}
		if (n > 1 && this.options.legend) {
			let index = 0;
			const group = _.create('svg:g', '', { class: 'legend-switcher', transform: `translate(${this._width()},${this._height() + 40})` }, this._legend);
			const label = _.create('svg:text', '', { class: 'legend-switcher-label', 'text-anchor': 'end', x: -25, y: 5 }, group);
			const select = delta => {
				index = (index + delta + items.length) % items.length;
				label.textContent = L._(items[index][0].toUpperCase() + items[index].slice(1));
				for (const name of items) this._togglePath(name, name === items[index], true);
				this._updateArea();
			};
			label.addEventListener('click', () => select(1));
			for (const [x, y, angle, delta] of [[0, 3, 0, -1], [-13, 0, 180, 1]]) {
				const symbol = _.create('svg:path', '', { class: 'legend-switcher-symbol', d: 'M0,-6L5,3L-5,3Z',
					transform: `translate(${x},${y}) rotate(${angle})`, cursor: 'pointer', fill: '#000',
					role: 'button', tabindex: 0, 'aria-label': L._(delta > 0 ? 'Next profile' : 'Previous profile') }, group);
				symbol.addEventListener('click', () => select(delta));
				symbol.addEventListener('keydown', event => {
					if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(delta); }
				});
			}
			select(0);
		}
		items.forEach((name, i) => {
			const legend = this._legend.querySelector(`[data-name="${name}"]`);
			if (legend) legend.setAttribute('transform', `translate(${positions[i] * 55},${xAxesB * 2})`);
			this._togglePath(name, this.options[name] !== 'disabled', true);
		});
		this._mask.querySelectorAll('.gap').forEach(node => node.remove());
		this._maskGaps.forEach((index, i) => {
			if (i >= this._maskGaps.length - 2) return;
			const x1 = this._x(this._data[index][this.options.xAttr]);
			const x2 = this._x(this._data[this._maskGaps[i + 1]][this.options.xAttr]);
			_.create('svg:rect', '', { x: x1, y: 0, width: x2 - x1, height: this._height(), class: 'gap', 'fill-opacity': 0.8, fill: 'black' }, this._mask);
		});
		this._updateArea();
		return this;
	},

	_updateScale() {
		for (const name in this._domains) {
			const scale = this._scales[name];
			scale.domain(this._domains[name](this._data)).range(this._ranges[name](this._width(), this._height()));
			if (this._props.axes[name].axis === 'x') {
				const { k, x } = this._transform;
				scale.domain(scale.range().map(pixel => scale.invert((pixel - x) / k)));
			}
		}
		return { x: this._x, y: this._y };
	},

	_width() {
		return this.options.width - this.options.margins.left - this.options.margins.right;
	},

	_height() {
		return this.options.height - this.options.margins.top - this.options.margins.bottom;
	},

	_findIndexForXCoord(x) {
		return Math.min(this._data.length - 1, _.bisect(this._data, this._x.invert(x), this.options.xAttr));
	},

	_findIndexForLatLng(latlng) {
		let result = null, distance = Infinity;
		this._data.forEach((item, index) => {
			const current = latlng.distanceTo(item.latlng);
			if (current < distance) { distance = current; result = index; }
		});
		return result;
	},

	_resetDrag() {
		if (!this._selection) return;
		this._selection = null;
		for (const node of this._chart.panes.brush.querySelectorAll('.selection, .handle')) node.setAttribute('display', 'none');
		this._hideDiagramIndicator();
		this.fire('reset_drag');
	},

	_resetZoom() {
		this._setZoom(1, 0);
	},

	_showDiagramIndicator(item, xCoordinate) {
		this._tooltip.removeAttribute('display');
		const group = this._tooltip;
		const xCoord = xCoordinate, yCoord = this._y(item[this.options.yAttr]);
		group.replaceChildren();
		_.create('svg:line', '', { class: 'mouse-focus-line', x1: xCoord, x2: xCoord, y1: this._height(), y2: 0 }, group);
		const box = _.create('svg:g', '', { class: 'mouse-focus-label' }, group);
		const rect = _.create('svg:rect', '', { class: 'mouse-focus-label-rect', rx: 3, ry: 3 }, box);
		const text = _.create('svg:text', '', { class: 'mouse-focus-label-text', 'font-weight': 700 }, box);
		Object.values(this._props.tooltipItems).sort((a, b) => a.order - b.order).forEach(label => {
			_.create('svg:tspan', '', { class: 'mouse-focus-label-' + label.name, dy: '1.5em' }, text).textContent =
				typeof label.value === 'function' ? label.value(item) : label.value;
		});
		if (text.firstChild) text.firstChild.setAttribute('dy', '1em');
		for (const span of text.children) span.setAttribute('x', 0);
		const bounds = text.getBBox();
		const x = xCoord ? xCoord + (xCoord < this._width() / 2 ? 10 : -bounds.width - 10) : 0;
		const y = yCoord ? Math.max(yCoord - bounds.height, (L.Browser.webkit || L.Browser.safari) ? 0 : -Infinity) : 0;
		for (const span of text.children) span.setAttribute('x', x);
		text.setAttribute('y', y);
		_.setAttributes(rect, { x: x + bounds.x - 5, y: y + bounds.y - 5, width: bounds.width + 10, height: bounds.height + 10 });
	},

	_togglePath(name, enabled = true, lazy = false) {
		const path = this._paths[name];
		const legend = this._legend.querySelector(`[data-name="${name}"]`);
		path.classList.toggle('leaflet-hidden', !enabled);
		if (legend) {
			legend.querySelector('text').style.textDecorationLine = enabled ? '' : 'line-through';
			legend.querySelector('rect').style.fillOpacity = enabled ? '' : '0';
			legend.setAttribute('aria-pressed', enabled);
		}
		path.setAttribute('mask', `url(#${this._mask.id})`);
		if (!lazy) this._updateArea();
	},

	_hideDiagramIndicator() {
		this._tooltip.setAttribute('display', 'none');
	},

	_xTicks() {
		return this.__xTicks || Math.round(this._width() / 75);
	},

	_yTicks() {
		return this.__yTicks || Math.round(this._height() / 30);
	},
});
