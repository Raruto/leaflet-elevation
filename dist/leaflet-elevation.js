(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
}((function () { 'use strict';

    // Following https://github.com/Leaflet/Leaflet/blob/master/PLUGIN-GUIDE.md
    (function (factory, window) {
      // define an AMD module that relies on 'leaflet'
      if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory); // define a Common JS module that relies on 'leaflet'
      } else if (typeof exports === 'object') {
        module.exports = factory(require('leaflet'));
      } // attach your plugin to the global 'L' variable


      if (typeof window !== 'undefined' && window.L) {
        factory(window.L);
      }
    })(function (L) {
      L.locales = {};
      L.locale = null;

      L.registerLocale = function registerLocale(code, locale) {
        L.locales[code] = L.Util.extend({}, L.locales[code], locale);
      };

      L.setLocale = function setLocale(code) {
        L.locale = code;
      };

      return L.i18n = L._ = function translate(string, data) {
        if (L.locale && L.locales[L.locale] && L.locales[L.locale][string]) {
          string = L.locales[L.locale][string];
        }

        try {
          // Do not fail if some data is missing
          // a bad translation should not break the app
          string = L.Util.template(string, data);
        } catch (err) {
          /*pass*/
        }

        return string;
      };
    }, window);

    function _typeof(obj) {
      "@babel/helpers - typeof";

      if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        _typeof = function (obj) {
          return typeof obj;
        };
      } else {
        _typeof = function (obj) {
          return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        };
      }

      return _typeof(obj);
    }

    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        obj[key] = value;
      }

      return obj;
    }

    /**
     * Recursive deep merge objects.
     * Alternative to L.Util.setOptions(this, options).
     */
    function deepMerge(target) {
      for (var _len = arguments.length, sources = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        sources[_key - 1] = arguments[_key];
      }

      if (!sources.length) return target;
      var source = sources.shift();

      if (isObject(target) && isObject(source)) {
        for (var key in source) {
          if (isObject(source[key])) {
            if (!target[key]) Object.assign(target, _defineProperty({}, key, {}));
            deepMerge(target[key], source[key]);
          } else {
            Object.assign(target, _defineProperty({}, key, source[key]));
          }
        }
      }

      return deepMerge.apply(void 0, [target].concat(sources));
    }
    /**
     * Wait for document load before execute function.
     */

    function deferFunc(f) {
      if (document.readyState !== 'complete') window.addEventListener("load", f, {
        once: true
      });else f();
    }
    /*
     * Similar to L.Util.formatNum
     */

    function formatNum(num, dec, sep) {
      return num.toFixed(dec).toString().split(".").join(sep || ".");
    }
    /**
     * Simple GeoJSON data loader.
     */

    function GeoJSONLoader(data, control) {
      if (typeof data === "string") {
        data = JSON.parse(data);
      }

      control = control || this;
      var layer = L.geoJson(data, {
        style: function style(feature) {
          var style = L.extend({}, control.options.polyline);

          if (control.options.theme) {
            style.className += ' ' + control.options.theme;
          }

          return style;
        },
        pointToLayer: function pointToLayer(feature, latlng) {
          var marker = L.marker(latlng, {
            icon: control.options.gpxOptions.marker_options.wptIcons['']
          });
          var desc = feature.properties.desc ? feature.properties.desc : '';
          var name = feature.properties.name ? feature.properties.name : '';

          if (name || desc) {
            marker.bindPopup("<b>" + name + "</b>" + (desc.length > 0 ? '<br>' + desc : '')).openPopup();
          }

          control.fire('waypoint_added', {
            point: marker,
            point_type: 'waypoint',
            element: latlng
          });
          return marker;
        },
        onEachFeature: function onEachFeature(feature, layer) {
          if (feature.geometry.type == 'Point') return;
          control.addData(feature, layer);
          control.track_info = L.extend({}, control.track_info, {
            type: "geojson",
            name: data.name
          });
        }
      });

      L.Control.Elevation._d3LazyLoader.then(function () {
        control._fireEvt("eledata_loaded", {
          data: data,
          layer: layer,
          name: control.track_info.name,
          track_info: control.track_info
        });
      });

      return layer;
    }
    /**
     * Simple GPX data loader.
     */

    function GPXLoader(data, control) {
      control = control || this;
      control.options.gpxOptions.polyline_options = L.extend({}, control.options.polyline, control.options.gpxOptions.polyline_options);

      if (control.options.theme) {
        control.options.gpxOptions.polyline_options.className += ' ' + control.options.theme;
      }

      var layer = new L.GPX(data, control.options.gpxOptions); // similar to L.GeoJSON.pointToLayer

      layer.on('addpoint', function (e) {
        control.fire("waypoint_added", e);
      }); // similar to L.GeoJSON.onEachFeature

      layer.on("addline", function (e) {
        control.addData(e.line
        /*, layer*/
        );
        control.track_info = L.extend({}, control.track_info, {
          type: "gpx",
          name: layer.get_name()
        });
      }); // unlike the L.GeoJSON, L.GPX parsing is async

      layer.once('loaded', function (e) {
        L.Control.Elevation._d3LazyLoader.then(function () {
          control._fireEvt("eledata_loaded", {
            data: data,
            layer: layer,
            name: control.track_info.name,
            track_info: control.track_info
          });
        });
      });
      return layer;
    }
    /**
     * Check DOM element visibility.
     */

    function isDomVisible(elem) {
      return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
    }
    /**
     * Check object type.
     */

    function isObject(item) {
      return item && _typeof(item) === 'object' && !Array.isArray(item);
    }
    /**
     * Check DOM element viewport visibility.
     */

    function isVisible(elem) {
      if (!elem) return false;
      var styles = window.getComputedStyle(elem);

      function isVisibleByStyles(elem, styles) {
        return styles.visibility !== 'hidden' && styles.display !== 'none';
      }

      function isAboveOtherElements(elem, styles) {
        var boundingRect = elem.getBoundingClientRect();
        var left = boundingRect.left + 1;
        var right = boundingRect.right - 1;
        var top = boundingRect.top + 1;
        var bottom = boundingRect.bottom - 1;
        var above = true;
        var pointerEvents = elem.style.pointerEvents;
        if (styles['pointer-events'] == 'none') elem.style.pointerEvents = 'auto';
        if (document.elementFromPoint(left, top) !== elem) above = false;
        if (document.elementFromPoint(right, top) !== elem) above = false; // Only for completely visible elements
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

    function isJSONDoc(doc, lazy) {
      lazy = typeof lazy === "undefined" ? true : lazy;

      if (typeof doc === "string" && lazy) {
        doc = doc.trim();
        return doc.indexOf("{") == 0 || doc.indexOf("[") == 0;
      } else {
        try {
          JSON.parse(doc.toString());
        } catch (e) {
          if (_typeof(doc) === "object" && lazy) return true;
          console.warn(e);
          return false;
        }

        return true;
      }
    }
    /**
     * Check XML object type.
     */

    function isXMLDoc(doc, lazy) {
      lazy = typeof lazy === "undefined" ? true : lazy;

      if (typeof doc === "string" && lazy) {
        doc = doc.trim();
        return doc.indexOf("<") == 0;
      } else {
        var documentElement = (doc ? doc.ownerDocument || doc : 0).documentElement;
        return documentElement ? documentElement.nodeName !== "HTML" : false;
      }
    }
    /**
     * Async JS script download.
     */

    function lazyLoader(url, skip, loader) {
      if (skip === false) {
        return Promise.resolve();
      }

      if (loader instanceof Promise) {
        return loader;
      }

      return new Promise(function (resolve, reject) {
        var tag = document.createElement("script");
        tag.addEventListener('load', resolve, {
          once: true
        });
        tag.src = url;
        document.head.appendChild(tag);
      });
    }
    /**
     * Download data from a remote url.
     */

    function loadFile(url, success) {
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = "text";
        xhr.open('GET', url);

        xhr.onload = function () {
          return resolve(xhr.response);
        };

        xhr.onerror = function () {
          return reject("Error " + xhr.status + " while fetching remote file: " + url);
        };

        xhr.send();
      });
    }
    /**
     * Generate download data event.
     */

    function saveFile(dataURI, fileName) {
      var a = create('a', '', {
        href: dataURI,
        target: '_new',
        download: fileName || "",
        style: "display:none;"
      });
      var b = document.body;
      b.appendChild(a);
      a.click();
      b.removeChild(a);
    }
    /**
     * Wait for element visible before execute function.
     */

    function waitHolder(elem) {
      return new Promise(function (resolve, reject) {
        var ticking = false;

        var scrollFn = function scrollFn() {
          if (!ticking) {
            L.Util.requestAnimFrame(function () {
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
        if (elem) elem.addEventListener('mouseenter', scrollFn, {
          once: true
        });
        scrollFn();
      });
    }
    /**
     * A little bit safier than L.DomUtil.addClass
     */

    function addClass(targetNode, className) {
      each(className.split(" "), function (s) {
        if (targetNode && className) L.DomUtil.addClass(targetNode, s);
      });
    }
    /**
     * A little bit safier than L.DomUtil.removeClass()
     */

    function removeClass(targetNode, className) {
      each(className.split(" "), function (s) {
        if (targetNode && className) L.DomUtil.removeClass(targetNode, s);
      });
    }
    function toggleClass(targetNode, className, conditional) {
      return (conditional ? addClass : removeClass).call(null, targetNode, className);
    }
    function style(targetNode, name, value) {
      if (typeof value === "undefined") return L.DomUtil.getStyle(targetNode, name);else return targetNode.style.setProperty(name, value);
    }
    /**
     * A little bit shorter than L.DomUtil.create()
     */

    function create(tagName, className, attributes, parent) {
      var elem = L.DomUtil.create(tagName, className || "");
      if (attributes) setAttributes(elem, attributes);
      if (parent) append(parent, elem);
      return elem;
    }
    /**
     * Same as node.appendChild()
     */

    function append(parent, child) {
      return parent.appendChild(child);
    }
    /**
     * Same as node.insertAdjacentElement()
     */

    function insert(parent, child, position) {
      return parent.insertAdjacentElement(position, child);
    }
    /**
     * Loop for node.setAttribute()
     */

    function setAttributes(elem, attrs) {
      for (var k in attrs) {
        elem.setAttribute(k, attrs[k]);
      }
    }
    /**
     * Same as node.querySelector().
     */

    function select(selector, context) {
      return (context || document).querySelector(selector);
    }
    /**
     * Alias for L.DomEvent.on.
     */

    var on = L.DomEvent.on;
    /**
     * Alias for L.DomEvent.off.
     */

    var off = L.DomEvent.off;
    /**
     * Alias for L.DomUtil.hasClass.
     */

    var hasClass = L.DomUtil.hasClass;
    function randomId() {
      return Math.random().toString(36).substr(2, 9);
    }
    function each(obj, fn) {
      for (var i in obj) {
        fn(obj[i], i);
      }
    }

    var _ = /*#__PURE__*/Object.freeze({
        __proto__: null,
        deepMerge: deepMerge,
        deferFunc: deferFunc,
        formatNum: formatNum,
        GeoJSONLoader: GeoJSONLoader,
        GPXLoader: GPXLoader,
        isDomVisible: isDomVisible,
        isObject: isObject,
        isVisible: isVisible,
        isJSONDoc: isJSONDoc,
        isXMLDoc: isXMLDoc,
        lazyLoader: lazyLoader,
        loadFile: loadFile,
        saveFile: saveFile,
        waitHolder: waitHolder,
        addClass: addClass,
        removeClass: removeClass,
        toggleClass: toggleClass,
        style: style,
        create: create,
        append: append,
        insert: insert,
        setAttributes: setAttributes,
        select: select,
        on: on,
        off: off,
        hasClass: hasClass,
        randomId: randomId,
        each: each
    });

    var Area = function Area(_ref) {
      var data = _ref.data,
          name = _ref.name,
          xAttr = _ref.xAttr,
          yAttr = _ref.yAttr,
          scaleX = _ref.scaleX,
          scaleY = _ref.scaleY,
          height = _ref.height,
          _ref$interpolation = _ref.interpolation,
          interpolation = _ref$interpolation === void 0 ? "curveLinear" : _ref$interpolation;
      return function (path) {
        if (typeof interpolation === 'string') interpolation = d3[interpolation];
        var area = d3.area().curve(interpolation).x(function (d) {
          return d.xDiagCoord = scaleX(d[xAttr]);
        }).y0(height).y1(function (d) {
          return scaleY(d[yAttr]);
        });
        if (data) path.datum(data).attr("d", area);
        if (name) path.attr('data-name', name);
        return area;
      };
    };
    var AreaPath = function AreaPath(props) {
      return d3.create('svg:path').attr("class", "area").call(Area(props));
    };
    var Axis = function Axis(_ref2) {
      var _ref2$type = _ref2.type,
          type = _ref2$type === void 0 ? "axis" : _ref2$type,
          _ref2$tickSize = _ref2.tickSize,
          tickSize = _ref2$tickSize === void 0 ? 6 : _ref2$tickSize,
          _ref2$tickPadding = _ref2.tickPadding,
          tickPadding = _ref2$tickPadding === void 0 ? 3 : _ref2$tickPadding,
          position = _ref2.position,
          height = _ref2.height,
          width = _ref2.width,
          axis = _ref2.axis,
          scale = _ref2.scale,
          ticks = _ref2.ticks,
          tickFormat = _ref2.tickFormat,
          label = _ref2.label,
          labelX = _ref2.labelX,
          labelY = _ref2.labelY;
      return function (g) {
        var w = 0,
            h = 0;
        if (position == "bottom") h = height;
        if (position == "right") w = width;

        if (axis == "x" && type == "grid") {
          tickSize = -height;
        } else if (axis == "y" && type == "grid") {
          tickSize = -width;
        }

        var axisScale = d3["axis" + position.replace(/\b\w/g, function (l) {
          return l.toUpperCase();
        })]().scale(scale).ticks(ticks).tickPadding(tickPadding).tickSize(tickSize).tickFormat(tickFormat);
        var axisGroup = g.append("g").attr("class", [axis, type, position].join(" ")).attr("transform", "translate(" + w + "," + h + ")").call(axisScale);

        if (label) {
          axisGroup.append("text").attr("x", labelX).attr("y", labelY).text(label);
        }

        return axisGroup;
      };
    };
    var DragRectangle = function DragRectangle(_ref3) {
      var dragStartCoords = _ref3.dragStartCoords,
          dragEndCoords = _ref3.dragEndCoords,
          height = _ref3.height;
      return function (rect) {
        var x1 = Math.min(dragStartCoords[0], dragEndCoords[0]);
        var x2 = Math.max(dragStartCoords[0], dragEndCoords[0]);
        return rect.attr("width", x2 - x1).attr("height", height).attr("x", x1);
      };
    };
    var FocusRect = function FocusRect(_ref4) {
      var width = _ref4.width,
          height = _ref4.height;
      return function (rect) {
        return rect.attr("width", width).attr("height", height).style("fill", "none").style("stroke", "none").style("pointer-events", "all");
      };
    };
    var Grid = function Grid(props) {
      props.type = "grid";
      return Axis(props);
    };
    var HeightFocusLine = function HeightFocusLine(_ref5) {
      var theme = _ref5.theme,
          _ref5$xCoord = _ref5.xCoord,
          xCoord = _ref5$xCoord === void 0 ? 0 : _ref5$xCoord,
          _ref5$yCoord = _ref5.yCoord,
          yCoord = _ref5$yCoord === void 0 ? 0 : _ref5$yCoord,
          _ref5$length = _ref5.length,
          length = _ref5$length === void 0 ? 0 : _ref5$length;
      return function (line) {
        return line.attr("class", theme + " height-focus line").attr("x1", xCoord).attr("x2", xCoord).attr("y1", yCoord).attr("y2", length);
      };
    };
    var HeightFocusLabel = function HeightFocusLabel(_ref6) {
      var theme = _ref6.theme,
          _ref6$xCoord = _ref6.xCoord,
          xCoord = _ref6$xCoord === void 0 ? 0 : _ref6$xCoord,
          _ref6$yCoord = _ref6.yCoord,
          yCoord = _ref6$yCoord === void 0 ? 0 : _ref6$yCoord,
          label = _ref6.label;
      return function (text) {
        text.attr("class", theme + " height-focus-label").style("pointer-events", "none").attr("x", xCoord + 5).attr("y", yCoord);
        var y = text.select(".height-focus-y");
        if (!y.node()) y = text.append("svg:tspan");
        y.attr("class", "height-focus-y").text(label);
        text.selectAll('tspan').attr("x", xCoord + 5);
        return text;
      };
    };
    var HeightFocusMarker = function HeightFocusMarker(_ref7) {
      var theme = _ref7.theme,
          _ref7$xCoord = _ref7.xCoord,
          xCoord = _ref7$xCoord === void 0 ? 0 : _ref7$xCoord,
          _ref7$yCoord = _ref7.yCoord,
          yCoord = _ref7$yCoord === void 0 ? 0 : _ref7$yCoord;
      return function (circle) {
        return circle.attr("class", theme + " height-focus circle-lower").attr("transform", "translate(" + xCoord + "," + yCoord + ")").attr("r", 6).attr("cx", 0).attr("cy", 0);
      };
    };
    var LegendItem = function LegendItem(_ref8) {
      var name = _ref8.name,
          width = _ref8.width,
          height = _ref8.height,
          _ref8$margins = _ref8.margins,
          margins = _ref8$margins === void 0 ? {} : _ref8$margins;
      return function (g) {
        g.attr("class", "legend-item legend-" + name.toLowerCase()).attr("data-name", name);
        g.append("rect").attr("class", "area").attr("x", width / 2 - 50).attr("y", height + margins.bottom / 2).attr("width", 50).attr("height", 10).attr("opacity", 0.75);
        g.append('text').text(L._(name)).attr("x", width / 2 + 5).attr("font-size", 10).style("text-decoration-thickness", "2px").style("font-weight", "700").attr('y', height + margins.bottom / 2).attr('dy', "0.75em");
        return g;
      };
    };
    var MouseFocusLine = function MouseFocusLine(_ref9) {
      var _ref9$xCoord = _ref9.xCoord,
          xCoord = _ref9$xCoord === void 0 ? 0 : _ref9$xCoord,
          height = _ref9.height;
      return function (line) {
        return line.attr('class', 'mouse-focus-line').attr('x2', xCoord).attr('y2', 0).attr('x1', xCoord).attr('y1', height);
      };
    };
    var MouseFocusLabel = function MouseFocusLabel(_ref10) {
      var xCoord = _ref10.xCoord,
          yCoord = _ref10.yCoord,
          _ref10$labelX = _ref10.labelX,
          labelX = _ref10$labelX === void 0 ? "" : _ref10$labelX,
          _ref10$labelY = _ref10.labelY,
          labelY = _ref10$labelY === void 0 ? "" : _ref10$labelY,
          width = _ref10.width;
      return function (g) {
        g.attr('class', 'mouse-focus-label');
        var rect = g.select(".mouse-focus-label-rect");
        var text = g.select(".mouse-focus-label-text");
        var y = text.select(".mouse-focus-label-y");
        var x = text.select(".mouse-focus-label-x");
        if (!rect.node()) rect = g.append("rect");
        if (!text.node()) text = g.append("svg:text");
        if (!y.node()) y = text.append("svg:tspan");
        if (!x.node()) x = text.append("svg:tspan");
        y.text(labelY);
        x.text(labelX); // Sets focus-label-text position to the left / right of the mouse-focus-line

        var xAlign = 0;
        var yAlign = 0;
        var bbox = {
          width: 0,
          height: 0
        };

        try {
          bbox = text.node().getBBox();
        } catch (e) {
          return g;
        }

        if (xCoord) xAlign = xCoord + (xCoord < width / 2 ? 10 : -bbox.width - 10);
        if (yCoord) yAlign = Math.max(yCoord - bbox.height, L.Browser.webkit ? 0 : -Infinity);
        rect.attr("class", "mouse-focus-label-rect").attr("x", xAlign - 5).attr("y", yAlign - 5).attr("width", bbox.width + 10).attr("height", bbox.height + 10).attr("rx", 3).attr("ry", 3);
        text.attr("class", "mouse-focus-label-text").style("font-weight", "700").attr("y", yAlign);
        y.attr("class", "mouse-focus-label-y").attr("dy", "1em");
        x.attr("class", "mouse-focus-label-x").attr("dy", "2em");
        text.selectAll('tspan').attr("x", xAlign);
        return g;
      };
    };
    var Scale = function Scale(_ref11) {
      var data = _ref11.data,
          attr = _ref11.attr,
          min = _ref11.min,
          forceBounds = _ref11.forceBounds,
          range = _ref11.range;
      var domain = data ? d3.extent(data, function (d) {
        return d[attr];
      }) : [0, 1];

      if (typeof min !== "undefined" && (min < domain[0] || forceBounds)) {
        domain[0] = min;
      }

      if (typeof max !== "undefined" && (max > domain[1] || forceBounds)) {
        domain[1] = max;
      }

      return d3.scaleLinear().range(range).domain(domain);
    };
    var Bisect = function Bisect(_ref12) {
      var _ref12$data = _ref12.data,
          data = _ref12$data === void 0 ? [0, 1] : _ref12$data,
          scale = _ref12.scale,
          x = _ref12.x,
          attr = _ref12.attr;
      return d3.bisector(function (d) {
        return d[attr];
      }).left(data, scale.invert(x));
    };

    var D3 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        Area: Area,
        AreaPath: AreaPath,
        Axis: Axis,
        DragRectangle: DragRectangle,
        FocusRect: FocusRect,
        Grid: Grid,
        HeightFocusLine: HeightFocusLine,
        HeightFocusLabel: HeightFocusLabel,
        HeightFocusMarker: HeightFocusMarker,
        LegendItem: LegendItem,
        MouseFocusLine: MouseFocusLine,
        MouseFocusLabel: MouseFocusLabel,
        Scale: Scale,
        Bisect: Bisect
    });

    var Chart = L.Class.extend({
      includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
      initialize: function initialize(opts) {
        this.options = opts;
        this._data = [];
        this._draggingEnabled = opts.dragging;

        if (opts.imperial) {
          this._xLabel = "mi";
          this._yLabel = "ft";
        } else {
          this._xLabel = opts.xLabel;
          this._yLabel = opts.yLabel;
        }

        this._xTicks = opts.xTicks;
        this._yTicks = opts.yTicks;

        var scale = this._updateScale();

        var svg = this._container = d3.create("svg").attr("class", "background").attr("width", opts.width).attr("height", opts.height);
        var g = svg.append("g").attr("transform", "translate(" + opts.margins.left + "," + opts.margins.top + ")").call(this._appendGrid()).call(this._appendAxis()).call(this._appendAreaPath()).call(this._appendFocusable()).call(this._appendLegend());
        this._grid = svg.select('.grid');
        this._area = svg.select('.area');
        this._path = svg.select('.area path');
        this._axis = svg.select('.axis');
        this._focus = svg.select('.focus');
        this._focusRect = this._focus.select('rect');
        this._legend = svg.select('.legend');
        this._x = scale.x;
        this._y = scale.y;
      },
      update: function update(props) {
        if (props.data) this._data = props.data;
        if (props.options) this.options = props.options;

        this._updateScale();

        this._updateAxis();

        this._updateAreaPath();

        return this;
      },
      render: function render() {
        var _this = this;

        return function (container) {
          return container.append(function () {
            return _this._container.node();
          });
        };
      },
      clear: function clear() {
        this._resetDrag();

        this._area.selectAll('path').attr("d", "M0 0");

        if (this._path) ;
      },
      _updateScale: function _updateScale() {
        var opts = this.options;
        this._x = Scale({
          data: this._data,
          range: [0, this._width()],
          attr: opts.xAttr,
          min: opts.xAxisMin,
          max: opts.xAxisMax,
          forceBounds: opts.forceAxisBounds
        });
        this._y = Scale({
          data: this._data,
          range: [this._height(), 0],
          attr: opts.yAttr,
          min: opts.yAxisMin,
          max: opts.yAxisMax,
          forceBounds: opts.forceAxisBounds
        });
        return {
          x: this._x,
          y: this._y
        };
      },

      /**
       * Update chart axis.
       */
      _updateAxis: function _updateAxis() {
        this._grid.selectAll('g').remove();

        this._axis.selectAll('g').remove();

        this._grid.call(this._appendXGrid()).call(this._appendYGrid());

        this._axis.call(this._appendXaxis()).call(this._appendYaxis()); // this.fire('axis_updated');

      },
      _updateAreaPath: function _updateAreaPath() {
        var opts = this.options;

        this._path.call(Area({
          interpolation: opts.interpolation,
          data: this._data,
          name: 'Altitude',
          xAttr: opts.xAttr,
          yAttr: opts.yAttr,
          width: this._width(),
          height: this._height(),
          scaleX: this._x,
          scaleY: this._y
        }));
      },

      /**
       * Generate "grid".
       */
      _appendGrid: function _appendGrid() {
        var _this2 = this;

        return function (g) {
          return g.append("g").attr("class", "grid").call(_this2._appendXGrid()).call(_this2._appendYGrid());
        };
      },

      /**
       * Generate "x-grid".
       */
      _appendXGrid: function _appendXGrid() {
        return Grid({
          axis: "x",
          position: "bottom",
          width: this._width(),
          height: this._height(),
          scale: this._x,
          ticks: this._xTicks,
          tickFormat: ""
        });
      },

      /**
       * Generate "y-grid".
       */
      _appendYGrid: function _appendYGrid() {
        return Grid({
          axis: "y",
          position: "left",
          width: this._width(),
          height: this._height(),
          scale: this._y,
          ticks: this.options.yTicks,
          tickFormat: ""
        });
      },

      /**
       * Generate "axis".
       */
      _appendAxis: function _appendAxis() {
        var _this3 = this;

        return function (g) {
          return g.append("g").attr("class", "axis").call(_this3._appendXaxis()).call(_this3._appendYaxis());
        };
      },

      /**
       * Generate "x-axis".
       */
      _appendXaxis: function _appendXaxis() {
        return Axis({
          axis: "x",
          position: "bottom",
          width: this._width(),
          height: this._height(),
          scale: this._x,
          ticks: this._xTicks,
          label: this._xLabel,
          labelY: 25,
          labelX: this._width() + 6
        });
      },

      /**
       * Generate "y-axis".
       */
      _appendYaxis: function _appendYaxis() {
        return Axis({
          axis: "y",
          position: "left",
          width: this._width(),
          height: this._height(),
          scale: this._y,
          ticks: this.options.yTicks,
          label: this._yLabel,
          labelX: -25,
          labelY: 3
        });
      },

      /**
       * Generate "path".
       */
      _appendAreaPath: function _appendAreaPath() {
        return function (g) {
          return g.append('g').attr("class", "area").append('path');
        };
      },
      _appendFocusable: function _appendFocusable() {
        var _this4 = this;

        return function (g) {
          return g.append('g').attr("class", 'focus').call(_this4._appendFocusRect()).call(_this4._appendMouseFocusG());
        };
      },

      /**
       * Generate "mouse-focus" and "drag-rect".
       */
      _appendFocusRect: function _appendFocusRect() {
        var _this5 = this;

        return function (g) {
          var focusRect = g.append("rect").call(FocusRect({
            width: _this5._width(),
            height: _this5._height()
          }));

          if (L.Browser.mobile) {
            focusRect.on("touchstart.drag", _this5._dragStartHandler.bind(_this5)).on("touchmove.drag", _this5._dragHandler.bind(_this5)).on("touchstart.focus", _this5._mousemoveHandler.bind(_this5)).on("touchmove.focus", _this5._mousemoveHandler.bind(_this5));
            L.DomEvent.on(_this5._container.node(), 'touchend', _this5._dragEndHandler, _this5);
          }

          focusRect.on("mousedown.drag", _this5._dragStartHandler.bind(_this5)).on("mousemove.drag", _this5._dragHandler.bind(_this5)).on("mouseenter.focus", _this5._mouseenterHandler.bind(_this5)).on("mousemove.focus", _this5._mousemoveHandler.bind(_this5)).on("mouseout.focus", _this5._mouseoutHandler.bind(_this5));
          L.DomEvent.on(_this5._container.node(), 'mouseup', _this5._dragEndHandler, _this5);
          return focusRect;
        };
      },

      /**
       * Generate "mouse-focus".
       */
      _appendMouseFocusG: function _appendMouseFocusG() {
        var _this6 = this;

        return function (g) {
          var focusG = _this6._focusG = g.append("g").attr("class", "mouse-focus-group hidden");
          _this6._focusline = focusG.append('svg:line').call(MouseFocusLine({
            xCoord: 0,
            height: _this6._height()
          }));
          _this6._focuslabel = focusG.append("g").call(MouseFocusLabel({
            xCoord: 0,
            yCoord: 0,
            height: _this6._height(),
            width: _this6._width(),
            labelX: "",
            labelY: ""
          }));
          return focusG;
        };
      },

      /**
       * Generate "legend".
       */
      _appendLegend: function _appendLegend() {
        return function (g) {
          // if (!this.options.legend) return;
          var legend = g.append('g').attr("class", "legend"); // this.fire("legend");
          // let items = legend.selectAll('.legend-item')
          // 	.on('click', (d, i) => {
          // 		let target = items.nodes()[i];
          // 		let name = target.getAttribute('data-name');
          // 		let path = this._area.select('path[data-name="' + name + '"]').node();
          // 		// this._fireEvt("elepath_toggle", { path: path, name: name, legend: target });
          // 	});

          return legend;
        };
      },

      /**
       * Calculates chart width.
       */
      _width: function _width() {
        var opts = this.options;
        return opts.width - opts.margins.left - opts.margins.right;
      },

      /**
       * Calculates chart height.
       */
      _height: function _height() {
        var opts = this.options;
        return opts.height - opts.margins.top - opts.margins.bottom;
      },

      /*
       * Handle drag operations.
       */
      _dragHandler: function _dragHandler() {
        //we don't want map events to occur here
        d3.event.preventDefault();
        d3.event.stopPropagation();
        this._gotDragged = true;

        this._drawDragRectangle();
      },

      /*
       * Handles start of drag operations.
       */
      _dragStartHandler: function _dragStartHandler() {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        this._gotDragged = false;
        this._dragStartCoords = d3.mouse(this._focusRect.node());
      },

      /*
       * Draws the currently dragged rectangle over the chart.
       */
      _drawDragRectangle: function _drawDragRectangle() {
        if (!this._dragStartCoords || !this._draggingEnabled) return;

        if (!this._dragRectangle) {
          this._dragRectangle = this._focus.insert("rect", ".mouse-focus-group").attr('class', 'mouse-drag').style("pointer-events", "none");
        }

        this._dragRectangle.call(DragRectangle({
          dragStartCoords: this._dragStartCoords,
          dragEndCoords: this._dragCurrentCoords = d3.mouse(this._focusRect.node()),
          height: this._height()
        }));
      },

      /*
       * Handles end of drag operations. Zooms the map to the selected items extent.
       */
      _dragEndHandler: function _dragEndHandler() {
        if (!this._dragStartCoords || !this._dragCurrentCoords || !this._gotDragged) {
          this._dragStartCoords = null;
          this._gotDragged = false;
          if (this._draggingEnabled) this._resetDrag();
          return;
        }

        var start = this._findIndexForXCoord(this._dragStartCoords[0]);

        var end = this._findIndexForXCoord(this._dragCurrentCoords[0]);

        if (start == end) return;
        this._dragStartCoords = null;
        this._gotDragged = false;
        this.fire('dragged', {
          dragstart: this._data[start],
          dragend: this._data[end]
        });
      },

      /*
       * Handles the moueseenter over the chart.
       */
      _mouseenterHandler: function _mouseenterHandler() {
        this.fire("mouse_enter");
      },

      /*
       * Handles the moueseover the chart and displays distance and altitude level.
       */
      _mousemoveHandler: function _mousemoveHandler(d, i, ctx) {
        var coords = d3.mouse(this._focusRect.node());
        var xCoord = coords[0];

        var item = this._data[this._findIndexForXCoord(xCoord)];

        this.fire("mouse_move", {
          item: item,
          xCoord: xCoord
        });
      },

      /*
       * Handles the moueseout over the chart.
       */
      _mouseoutHandler: function _mouseoutHandler() {
        this.fire("mouse_out");
      },

      /*
       * Finds a data entry for a given x-coordinate of the diagram
       */
      _findIndexForXCoord: function _findIndexForXCoord(x) {
        var _this7 = this;

        return d3.bisector(function (d) {
          return d[_this7.options.xAttr];
        }).left(this._data || [0, 1], this._x.invert(x));
      },

      /*
       * Finds a data entry for a given latlng of the map
       */
      _findIndexForLatLng: function _findIndexForLatLng(latlng) {
        return d3.bisector(function (d) {
          return d.latlng;
        }).left(this._data, latlng);
      },

      /*
       * Removes the drag rectangle and zoms back to the total extent of the data.
       */
      _resetDrag: function _resetDrag() {
        if (this._dragRectangle) {
          this._dragRectangle.remove();

          this._dragRectangle = null;

          this._hideDiagramIndicator();

          this.fire('reset_drag');
        }
      },

      /**
       * Display distance and altitude level ("focus-rect").
       */
      _showDiagramIndicator: function _showDiagramIndicator(item, xCoordinate) {
        // if (!this._chartEnabled) return;
        var opts = this.options;

        var yCoordinate = this._y(item[opts.yAttr]);

        this._focusG.classed("hidden", false);

        this._focusline.call(MouseFocusLine({
          xCoord: xCoordinate,
          height: this._height()
        }));

        this._focuslabel.call(MouseFocusLabel({
          xCoord: xCoordinate,
          yCoord: yCoordinate,
          height: this._height(),
          width: this._width(),
          labelX: formatNum(item[opts.xAttr], opts.decimalsX) + " " + this._xLabel,
          labelY: formatNum(item[opts.yAttr], opts.decimalsY) + " " + this._yLabel
        }));
      },
      _hideDiagramIndicator: function _hideDiagramIndicator() {
        this._focusG.classed("hidden", true);
      }
    }); // Chart.addInitHook(function() {
    // 	this.on('mouse_move', function(e) {
    // 		if (e.item) this._showDiagramIndicator(e.item, e.xCoord);
    // 	});
    //
    // });

    var Marker = L.Class.extend({
      initialize: function initialize(options) {
        this.options = options;

        if (this.options.imperial) {
          // this._distanceFactor = this.__mileFactor;
          // this._heightFactor = this.__footFactor;
          this._xLabel = "mi";
          this._yLabel = "ft";
        } else {
          // this._distanceFactor = this.options.distanceFactor;
          // this._heightFactor = this.options.heightFactor;
          this._xLabel = this.options.xLabel;
          this._yLabel = this.options.yLabel;
        }

        if (this.options.marker == 'elevation-line') {
          // this._container = d3.create("g").attr("class", "height-focus-group");
          this._focusline = d3.create('svg:line');
          this._focusmarker = d3.create("svg:circle");
          this._focuslabel = d3.create("svg:text");
        } else if (this.options.marker == 'position-marker') {
          this._marker = L.marker([0, 0], {
            icon: this.options.markerIcon,
            zIndexOffset: 1000000,
            interactive: false
          });
        }

        return this;
      },
      addTo: function addTo(map) {
        var _this = this;

        this._map = map;

        if (this.options.marker == 'elevation-line') {
          var g = this._container = d3.select(map.getPane('elevationPane')).select("svg > g").attr("class", "height-focus-group");
          g.append(function () {
            return _this._focusline.node();
          });
          g.append(function () {
            return _this._focusmarker.node();
          });
          g.append(function () {
            return _this._focuslabel.node();
          });
        } else if (this.options.marker == 'position-marker') {
          this._marker.addTo(map, {
            pane: 'elevationPane'
          });
        }

        return this;
      },

      /**
       * Update position marker ("leaflet-marker").
       */
      update: function update(props) {
        if (props.options) this.options = props.options;
        if (!this._map) this.addTo(props.map);
        var opts = this.options;
        this._latlng = props.item.latlng;
        var point = L.extend({}, props.item, this._map.latLngToLayerPoint(this._latlng));

        if (this.options.marker == 'elevation-line') {
          var normalizedAlt = this._height() / props.maxElevation * point.z;
          var normalizedY = point.y - normalizedAlt;

          this._container.classed("hidden", false);

          this._focusmarker.call(HeightFocusMarker({
            theme: opts.theme,
            xCoord: point.x,
            yCoord: point.y
          }));

          this._focusline.call(HeightFocusLine({
            theme: opts.theme,
            xCoord: point.x,
            yCoord: point.y,
            length: normalizedY
          }));

          this._focuslabel.call(HeightFocusLabel({
            theme: opts.theme,
            xCoord: point.x,
            yCoord: normalizedY,
            label: formatNum(point[opts.yAttr], opts.decimalsY) + " " + this._yLabel
          }));
        } else if (this.options.marker == 'position-marker') {
          removeClass(this._marker.getElement(), 'hidden');

          this._marker.setLatLng(this._latlng);
        }
      },

      /*
       * Hides the position/height indicator marker drawn onto the map
       */
      remove: function remove() {
        if (this.options.marker == 'elevation-line') {
          if (this._container) this._container.classed("hidden", true);
        } else if (this.options.marker == 'position-marker') {
          addClass(this._marker.getElement(), 'hidden');
        }
      },
      getLatLng: function getLatLng() {
        return this._latlng;
      },

      /**
       * Calculates chart height.
       */
      _height: function _height() {
        var opts = this.options;
        return opts.height - opts.margins.top - opts.margins.bottom;
      }
    });

    var Summary = L.Class.extend({
      initialize: function initialize(opts) {
        this.options = opts;

        var summary = this._container = create("div", "elevation-summary " + (opts.summary ? opts.summary + "-summary" : ''));

        style(summary, 'max-width', opts.width ? opts.width + 'px' : '');
      },
      render: function render() {
        var _this = this;

        return function (container) {
          return container.append(function () {
            return _this._container;
          });
        };
      },
      reset: function reset() {
        this._container.innerHTML = '';
      }
    });

    var Options = {
      autohide: !L.Browser.mobile,
      autohideMarker: true,
      collapsed: false,
      detached: true,
      distanceFactor: 1,
      decimalsX: 2,
      decimalsY: 0,
      dragging: !L.Browser.mobile,
      downloadLink: 'link',
      elevationDiv: "#elevation-div",
      followMarker: true,
      forceAxisBounds: false,
      gpxOptions: {
        async: true,
        marker_options: {
          startIconUrl: null,
          endIconUrl: null,
          shadowUrl: null,
          wptIcons: {
            '': L.divIcon({
              className: 'elevation-waypoint-marker',
              html: '<i class="elevation-waypoint-icon"></i>',
              iconSize: [30, 30],
              iconAnchor: [8, 30]
            })
          }
        }
      },
      height: 200,
      heightFactor: 1,
      imperial: false,
      interpolation: "curveLinear",
      lazyLoadJS: true,
      legend: true,
      loadData: {
        defer: false,
        lazy: false
      },
      margins: {
        top: 10,
        right: 20,
        bottom: 30,
        left: 50
      },
      marker: 'elevation-line',
      markerIcon: L.divIcon({
        className: 'elevation-position-marker',
        html: '<i class="elevation-position-icon"></i>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      }),
      placeholder: false,
      position: "topright",
      polyline: {
        className: 'elevation-polyline',
        color: '#000',
        opacity: 0.75,
        weight: 5,
        lineCap: 'round'
      },
      reverseCoords: false,
      skipNullZCoords: false,
      theme: "lightblue-theme",
      responsive: true,
      summary: 'inline',
      slope: false,
      sDeltaMax: undefined,
      sInterpolation: "curveStepAfter",
      sRange: undefined,
      width: 600,
      xAttr: "dist",
      xLabel: "km",
      xTicks: undefined,
      yAttr: "z",
      yAxisMax: undefined,
      yAxisMin: undefined,
      yLabel: "m",
      yTicks: undefined,
      zFollow: 13
    };

    var Elevation = L.Control.Elevation = L.Control.extend({
      includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
      options: Options,
      track_info: {},
      _data: [],
      _layers: L.featureGroup(),
      _chartEnabled: true,
      __mileFactor: 0.621371,
      __footFactor: 3.28084,
      __D3: 'https://unpkg.com/d3@5.15.0/dist/d3.min.js',
      __LGPX: 'https://unpkg.com/leaflet-gpx@1.5.0/gpx.js',

      /*
       * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
       */
      addData: function addData(d, layer) {
        var _this = this;

        if ((typeof layer === "undefined" || layer === null) && d.on) {
          layer = d;
        }

        Elevation._d3LazyLoader = lazyLoader(this.__D3, (typeof d3 === "undefined" ? "undefined" : _typeof(d3)) !== 'object' || !this.options.lazyLoadJS, Elevation._d3LazyLoader).then(function () {
          _this._addData(d);

          _this._addLayer(layer);

          _this._fireEvt("eledata_added", {
            data: d,
            layer: layer,
            track_info: _this.track_info
          });
        });
      },

      /**
       * Adds the control to the given map.
       */
      addTo: function addTo(map) {
        if (this.options.detached) {
          var eleDiv = this._initElevationDiv();

          if (!eleDiv.isConnected) insert(map.getContainer(), eleDiv, 'afterend');

          append(eleDiv, this.onAdd(map));
        } else {
          L.Control.prototype.addTo.call(this, map);
        }

        return this;
      },

      /*
       * Reset data and display
       */
      clear: function clear() {
        this._marker.remove();

        this._chart.clear();

        this._layers.clearLayers();

        this._data = [];
        this.track_info = {};

        this._fireEvt("eledata_clear");
      },

      /**
       * Disable dragging chart on touch events.
       */
      disableDragging: function disableDragging() {
        this._chart._draggingEnabled = false;

        this._resetDrag();
      },

      /**
       * Enable dragging chart on touch events.
       */
      enableDragging: function enableDragging() {
        this._chart._draggingEnabled = true;
      },

      /**
       * Sets a map view that contains the given geographical bounds.
       */
      fitBounds: function fitBounds(bounds) {
        bounds = bounds || this.getBounds();
        if (this._map && bounds.isValid()) this._map.fitBounds(bounds);
      },
      getBounds: function getBounds(data) {
        data = data || this._data;
        return L.latLngBounds(data.map(function (d) {
          return d.latlng;
        }));
      },

      /**
       * Get default zoom level when "followMarker" is true.
       */
      getZFollow: function getZFollow() {
        return this._zFollow;
      },

      /**
       * Hide current elevation chart profile.
       */
      hide: function hide() {
        style(this._container, "display", "none");
      },

      /**
       * Initialize chart control "options" and "container".
       */
      initialize: function initialize(options) {
        this.options = deepMerge({}, this.options, options);
        this._zFollow = this.options.zFollow;
        if (this.options.followMarker) this._setMapView = L.Util.throttle(this._setMapView, 300, this);
        if (this.options.placeholder) this.options.loadData.lazy = this.options.loadData.defer = true;
        if (this.options.legend) this.options.margins.bottom += 30;
      },

      /**
       * Alias for loadData
       */
      load: function load(data, opts) {
        this.loadData(data, opts);
      },

      /**
       * Alias for addTo
       */
      loadChart: function loadChart(map) {
        this.addTo(map);
      },

      /**
       * Load elevation data (GPX or GeoJSON).
       */
      loadData: function loadData(data, opts) {
        opts = L.extend({}, this.options.loadData, opts);

        if (opts.defer) {
          this.loadDefer(data, opts);
        } else if (opts.lazy) {
          this.loadLazy(data, opts);
        } else if (isXMLDoc(data)) {
          this.loadGPX(data);
        } else if (isJSONDoc(data)) {
          this.loadGeoJSON(data);
        } else {
          this.loadFile(data);
        }
      },

      /**
       * Wait for document load before download data.
       */
      loadDefer: function loadDefer(data, opts) {
        opts = L.extend({}, this.options.loadData, opts);
        opts.defer = false;

        deferFunc(L.bind(this.loadData, this, data, opts));
      },

      /**
       * Load data from a remote url.
       */
      loadFile: function loadFile$1(url) {
        var _this2 = this;

        loadFile(url).then(function (data) {
          _this2._downloadURL = url; // TODO: handle multiple urls?

          _this2.loadData(data, {
            lazy: false,
            defer: false
          });
        }).catch(function (err) {
          return console.warn(err);
        });
      },

      /**
       * Load raw GeoJSON data.
       */
      loadGeoJSON: function loadGeoJSON(data) {
        GeoJSONLoader(data, this);
      },

      /**
       * Load raw GPX data.
       */
      loadGPX: function loadGPX(data) {
        var _this3 = this;

        Elevation._gpxLazyLoader = lazyLoader(this.__LGPX, typeof L.GPX !== 'function' || !this.options.lazyLoadJS, Elevation._gpxLazyLoader).then(function () {
          return GPXLoader(data, _this3);
        });
      },

      /**
       * Wait for chart container visible before download data.
       */
      loadLazy: function loadLazy(data, opts) {
        var _this4 = this;

        opts = L.extend({}, this.options.loadData, opts);
        var elem = opts.lazy.parentNode ? opts.lazy : this.placeholder;

        waitHolder(elem).then(function () {
          opts.lazy = false;

          _this4.loadData(data, opts);

          _this4.once('eledata_loaded', function () {
            return opts.lazy.parentNode.removeChild(elem);
          });
        });
      },

      /**
       * Create container DOM element and related event listeners.
       * Called on control.addTo(map).
       */
      onAdd: function onAdd(map) {
        var _this5 = this;

        this._map = map;

        var container = this._container = create("div", "elevation-control elevation " + this.options.theme);

        if (!this.options.detached) {
          addClass(container, 'leaflet-control');
        }

        if (this.options.placeholder && !this._data.length) {
          this.placeholder = create('img', 'elevation-placeholder', typeof this.options.placeholder === 'string' ? {
            src: this.options.placeholder,
            alt: ''
          } : this.options.placeholder);

          insert(container, this.placeholder, 'beforebegin');
        }

        Elevation._d3LazyLoader = lazyLoader(this.__D3, (typeof d3 === "undefined" ? "undefined" : _typeof(d3)) !== 'object' || !this.options.lazyLoadJS, Elevation._d3LazyLoader).then(function () {
          _this5._initButton(container);

          _this5._initChart(container);

          _this5._initSummary(container);

          _this5._initMarker(map);

          _this5._initLayer(map);

          map.on('zoom viewreset zoomanim', _this5._hideMarker, _this5).on('resize', _this5._resetView, _this5).on('resize', _this5._resizeChart, _this5).on('mousedown', _this5._resetDrag, _this5);

          on(map.getContainer(), 'mousewheel', _this5._resetDrag, _this5);

          on(map.getContainer(), 'touchstart', _this5._resetDrag, _this5);

          _this5.on('eledata_added eledata_loaded', _this5._updateChart, _this5).on('eledata_added eledata_loaded', _this5._updateSummary, _this5);

          _this5._updateChart();

          _this5._updateSummary();
        });
        return container;
      },

      /**
       * Clean up control code and related event listeners.
       * Called on control.remove().
       */
      onRemove: function onRemove(map) {
        this._container = null;
        map.off('zoom viewreset zoomanim', this._hideMarker, this).off('resize', this._resetView, this).off('resize', this._resizeChart, this).off('mousedown', this._resetDrag, this);

        off(map.getContainer(), 'mousewheel', this._resetDrag, this);

        off(map.getContainer(), 'touchstart', this._resetDrag, this);

        this.off('eledata_added eledata_loaded', this._updateChart, this).off('eledata_added eledata_loaded', this._updateSummary, this);
      },

      /**
       * Redraws the chart control. Sometimes useful after screen resize.
       */
      redraw: function redraw() {
        this._resizeChart();
      },

      /**
       * Set default zoom level when "followMarker" is true.
       */
      setZFollow: function setZFollow(zoom) {
        this._zFollow = zoom;
      },

      /**
       * Hide current elevation chart profile.
       */
      show: function show() {
        style(this._container, "display", "block");
      },

      /*
       * Parsing data either from GPX or GeoJSON and update the diagram data
       */
      _addData: function _addData(d) {
        var _this6 = this;

        var geom = d && d.geometry;
        var feat = d && d.type === "FeatureCollection";
        var gpx = d && d._latlngs;

        if (geom) {
          switch (geom.type) {
            case 'LineString':
              this._addGeoJSONData(geom.coordinates);

              break;

            case 'MultiLineString':
              each(geom.coordinates, function (coords) {
                return _this6._addGeoJSONData(coords);
              });

              break;

            default:
              console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
          }
        }

        if (feat) {
          each(d.features, function (feature) {
            return _this6._addData(feature);
          });
        }

        if (gpx) {
          this._addGPXData(d._latlngs);
        }
      },

      /*
       * Parsing of GeoJSON data lines and their elevation in z-coordinate
       */
      _addGeoJSONData: function _addGeoJSONData(coords) {
        var _this7 = this;

        each(coords, function (point) {
          return _this7._addPoint(point[1], point[0], point[2]);
        });
      },

      /*
       * Parsing function for GPX data and their elevation in z-coordinate
       */
      _addGPXData: function _addGPXData(coords) {
        var _this8 = this;

        each(coords, function (point) {
          return _this8._addPoint(point.lat, point.lng, point.meta.ele);
        });
      },

      /*
       * Parse and push a single (x, y, z) point to current elevation profile.
       */
      _addPoint: function _addPoint(x, y, z) {
        if (this.options.reverseCoords) {
          var _ref = [y, x];
          x = _ref[0];
          y = _ref[1];
        }

        var data = this._data || [];
        var i = data.length;
        data.push({
          x: x,
          y: y,
          z: z,
          latlng: new L.LatLng(x, y)
        });
        this._data = data;

        this._fireEvt("eledata_updated", {
          index: i
        });
      },
      _addLayer: function _addLayer(layer) {
        if (layer) this._layers.addLayer(layer);
      },

      /**
       * Adds the control to the given "detached" div.
       */
      _initElevationDiv: function _initElevationDiv() {
        var eleDiv = select(this.options.elevationDiv);

        if (!eleDiv) {
          this.options.elevationDiv = '#elevation-div_' + randomId();
          eleDiv = create('div', 'leaflet-control elevation elevation-div', {
            id: this.options.elevationDiv.substr(1)
          });
        }

        if (this.options.detached) {
          addClass(eleDiv, 'elevation-detached');

          removeClass(eleDiv, 'leaflet-control');
        }

        this.eleDiv = eleDiv;
        return this.eleDiv;
      },

      /*
       * Collapse current chart control.
       */
      _collapse: function _collapse() {
        removeClass(this._container, 'elevation-expanded');

        addClass(this._container, 'elevation-collapsed');
      },

      /*
       * Expand current chart control.
       */
      _expand: function _expand() {
        removeClass(this._container, 'elevation-collapsed');

        addClass(this._container, 'elevation-expanded');
      },

      /*
       * Finds a data entry for the given LatLng
       */
      _findItemForLatLng: function _findItemForLatLng(latlng) {
        return this._data[this._chart._findIndexForLatLng(latlng)];
      },

      /*
       * Finds a data entry for the given xDiagCoord
       */
      _findItemForX: function _findItemForX(x) {
        return this._data[this._chart._findIndexForXCoord(x)];
      },

      /**
       * Fires an event of the specified type.
       */
      _fireEvt: function _fireEvt(type, data, propagate) {
        if (this.fire) this.fire(type, data, propagate);
        if (this._map) this._map.fire(type, data, propagate);
      },

      /**
       * Calculates chart height.
       */
      _height: function _height() {
        var opts = this.options;
        return opts.height - opts.margins.top - opts.margins.bottom;
      },

      /*
       * Hides the position/height indicator marker drawn onto the map
       */
      _hideMarker: function _hideMarker() {
        if (this.options.autohideMarker) {
          this._marker.remove();
        }
      },

      /**
       * Generate "svg" chart DOM element.
       */
      _initChart: function _initChart(container) {
        var opts = this.options;
        opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
        opts.yTicks = opts.yTicks || Math.round(this._height() / 30);

        if (opts.responsive) {
          if (opts.detached) {
            var offWi = this.eleDiv.offsetWidth;
            var offHe = this.eleDiv.offsetHeight;
            opts.width = offWi > 0 ? offWi : opts.width;
            opts.height = offHe - 20 > 0 ? offHe - 20 : opts.height; // 20 = horizontal scrollbar size.
          } else {
            opts._maxWidth = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;

            var containerWidth = this._map.getContainer().clientWidth;

            opts.width = opts._maxWidth > containerWidth ? containerWidth - 30 : opts.width;
          }
        }

        var chart = this._chart = new Chart(opts);
        d3.select(container).call(chart.render());
        chart.on('reset_drag', this._hideMarker, this).on('mouse_enter', this._fireEvt.bind('elechart_enter'), this).on('dragged', this._dragendHandler, this).on('mouse_move', this._mousemoveHandler, this).on('mouse_out', this._mouseoutHandler, this);

        this._fireEvt("elechart_axis");

        if (this.options.legend) this._fireEvt("elechart_legend");

        this._fireEvt("elechart_init");
      },
      _initLayer: function _initLayer() {
        var _this9 = this;

        this._layers.on('layeradd layerremove', function (e) {
          var layer = e.layer;
          var toggleClass = e.type == 'layeradd' ? addClass : removeClass;
          var toggleEvt = layer[e.type == 'layeradd' ? "on" : "off"].bind(layer);
          toggleClass(layer.getElement && layer.getElement(), _this9.options.polyline.className + ' ' + _this9.options.theme);
          toggleEvt("mousemove", _this9._mousemoveLayerHandler, _this9);
          toggleEvt("mouseout", _this9._mouseoutHandler, _this9);
        });
      },
      _initMarker: function _initMarker(map) {
        var pane = map.getPane('elevationPane');

        if (!pane) {
          pane = this._pane = map.createPane('elevationPane');
          pane.style.zIndex = 625; // This pane is above markers but below popups.

          pane.style.pointerEvents = 'none';
        }

        if (this._renderer) this._renderer.remove();
        this._renderer = L.svg({
          pane: "elevationPane"
        }).addTo(this._map); // default leaflet svg renderer

        this._marker = new Marker(this.options);
      },

      /**
       * Inspired by L.Control.Layers
       */
      _initButton: function _initButton(container) {
        //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
        container.setAttribute('aria-haspopup', true);

        if (!this.options.detached) {
          L.DomEvent.disableClickPropagation(container); //.disableScrollPropagation(container);
        }

        if (L.Browser.mobile) {
          on(container, 'click', L.DomEvent.stopPropagation);
        }

        on(container, 'mousewheel', this._mousewheelHandler, this);

        if (!this.options.detached) {
          var link = this._button = create('a', "elevation-toggle elevation-toggle-icon" + (this.options.autohide ? "" : " close-button"), {
            href: '#',
            title: L._('Elevation')
          }, container);

          if (this.options.collapsed) {
            this._collapse();

            if (this.options.autohide) {
              on(container, 'mouseover', this._expand, this);

              on(container, 'mouseout', this._collapse, this);
            } else {
              on(link, 'click', L.DomEvent.stop);

              on(link, 'click', this._toggle, this);
            }

            on(link, 'focus', this._toggle, this);

            this._map.on('click', this._collapse, this); // TODO: keyboard accessibility

          }
        }
      },
      _initSummary: function _initSummary(container) {
        var summary = this._summary = new Summary({
          summary: this.options.summary
        });
        d3.select(container).call(summary.render());
        this.summaryDiv = this._summary._container;
      },
      _dragendHandler: function _dragendHandler(e) {
        this._hideMarker();

        this.fitBounds(L.latLngBounds([e.dragstart.latlng, e.dragend.latlng]));

        this._fireEvt("elechart_dragged");
      },

      /*
       * Handles the moueseover the chart and displays distance and altitude level.
       */
      _mousemoveHandler: function _mousemoveHandler(e) {
        if (!this._data.length || !this._chartEnabled) {
          return;
        }

        var xCoord = e.xCoord;

        var item = this._findItemForX(xCoord);

        if (this._chartEnabled) this._chart._showDiagramIndicator(item, xCoord);

        this._updateMarker(item);

        this._setMapView(item);

        if (this._map) {
          addClass(this._map.getContainer(), 'elechart-hover');
        }

        this._fireEvt("elechart_change", {
          data: item,
          xCoord: xCoord
        });

        this._fireEvt("elechart_hover", {
          data: item,
          xCoord: xCoord
        });
      },

      /*
       * Handles mouseover events of the data layers on the map.
       */
      _mousemoveLayerHandler: function _mousemoveLayerHandler(e) {
        if (!this._data.length) {
          return;
        }

        var item = this._findItemForLatLng(e.latlng);

        if (item) {
          var xCoord = item.xDiagCoord;
          if (this._chartEnabled) this._chart._showDiagramIndicator(item, xCoord);

          this._updateMarker(item);

          this._fireEvt("elechart_change", {
            data: item,
            xCoord: xCoord
          });
        }
      },

      /*
       * Handles the moueseout over the chart.
       */
      _mouseoutHandler: function _mouseoutHandler() {
        if (!this.options.detached) {
          this._hideMarker();

          this._chart._hideDiagramIndicator();
        }

        if (this._map) {
          removeClass(this._map.getContainer(), 'elechart-hover');
        }

        this._fireEvt("elechart_leave");
      },

      /*
       * Handles the mouesewheel over the chart.
       */
      _mousewheelHandler: function _mousewheelHandler(e) {
        if (this._map.gestureHandling && this._map.gestureHandling._enabled) return;

        var ll = this._marker.getLatLng() || this._map.getCenter();

        var z = this._map.getZoom() + Math.sign(e.deltaY);

        this._resetDrag();

        this._map.flyTo(ll, z);
      },

      /*
       * Removes the drag rectangle and zoms back to the total extent of the data.
       */
      _resetDrag: function _resetDrag() {
        this._chart._resetDrag();

        this._hideMarker();
      },

      /**
       * Resets drag, marker and bounds.
       */
      _resetView: function _resetView() {
        if (this._map && this._map._isFullscreen) return;

        this._resetDrag();

        this._hideMarker();

        this.fitBounds();
      },

      /**
       * Hacky way for handling chart resize. Deletes it and redraw chart.
       */
      _resizeChart: function _resizeChart() {
        // prevent displaying chart on resize if hidden
        if (style(this._container, "display") == "none") return;

        if (this.options.responsive) {
          if (this.options.detached) {
            var newWidth = this.eleDiv.offsetWidth; // - 20;

            if (newWidth) {
              this.options.width = newWidth;
              this.eleDiv.innerHTML = "";

              append(this.eleDiv, this.onAdd(this._map));
            }
          } else {
            this._map.removeControl(this._container);

            this.addTo(this._map);
          }
        }
      },

      /**
       * Collapse or Expand current chart control.
       */
      _toggle: function _toggle() {
        if (hasClass(this._container, "elevation-expanded")) this._collapse();else this._expand();
      },

      /**
       * Sets the view of the map (center and zoom). Useful when "followMarker" is true.
       */
      _setMapView: function _setMapView(item) {
        if (!this.options.followMarker || !this._map) return;

        var zoom = this._map.getZoom();

        zoom = zoom < this._zFollow ? this._zFollow : zoom;

        this._map.setView(item.latlng, zoom, {
          animate: true,
          duration: 0.25
        });
      },

      /**
       * Calculates [x, y] domain and then update chart.
       */
      _updateChart: function _updateChart() {
        if (!this._data.length || !this._container) return;
        this._chart = this._chart.update({
          data: this._data
        });
        this._x = this._chart._x;
        this._y = this._chart._y;

        this._fireEvt("elechart_axis");

        this._fireEvt('elechart_updated');
      },

      /*
       * Update the position/height indicator marker drawn onto the map
       */
      _updateMarker: function _updateMarker(item) {
        this._marker.update({
          map: this._map,
          item: item,
          maxElevation: this._maxElevation,
          options: this.options
        });
      },

      /**
       * Update chart summary.
       */
      _updateSummary: function _updateSummary() {
        var _this10 = this;

        this._summary.reset();

        if (this.options.summary) {
          this._fireEvt("elechart_summary");
        }

        if (this.options.downloadLink && this._downloadURL) {
          // TODO: generate dynamically file content instead of using static file urls.
          this.summaryDiv.innerHTML += '<span class="download"><a href="#">' + L._('Download') + '</a></span>';

          select('.download a', this.summaryDiv).onclick = function (e) {
            e.preventDefault();

            _this10._fireEvt('eletrack_download', {
              downloadLink: _this10.options.downloadLink,
              confirm: saveFile.bind(_this10, _this10._downloadURL)
            });
          };
        }
      },

      /**
       * Calculates chart width.
       */
      _width: function _width() {
        var opts = this.options;
        return opts.width - opts.margins.left - opts.margins.right;
      }
    });
    /**
     * Attach here some useful elevation hooks.
     */

    Elevation.addInitHook(function () {
      this.on('waypoint_added', function (e) {
        var p = e.point,
            pop = p._popup;

        if (pop) {
          pop.options.className = 'elevation-popup';
        }

        if (pop._content) {
          pop._content = decodeURI(pop._content);
          p.bindTooltip(pop._content, {
            direction: 'top',
            sticky: true,
            opacity: 1,
            className: 'elevation-tooltip'
          }).openTooltip();
        }
      }); // autotoggle chart data on click

      this.on('elepath_toggle', function (e) {
        var _this11 = this;

        var path = e.path;

        var enable = hasClass(path, 'hidden');

        var label = select('text', e.legend);

        var rect = select('rect', e.legend);

        style(label, "text-decoration-line", enable ? "" : "line-through");

        style(rect, "fill-opacity", enable ? "" : "0");

        toggleClass(path, 'hidden', !enable);

        this._chartEnabled = this._chart._area.selectAll('path:not(.hidden)').nodes().length != 0;

        this._layers.eachLayer(function (l) {
          return toggleClass(l.getElement && l.getElement(), _this11.options.polyline.className + ' ' + _this11.options.theme, _this11._chartEnabled);
        });

        if (!this._chartEnabled) {
          this._chart._hideDiagramIndicator();

          this._marker.remove();
        }
      });
      this.on("elechart_updated", function () {
        var _this12 = this;

        // TODO: maybe should i listen for this inside chart.js?
        this._chart._legend.selectAll('.legend-item').on('click', function (d, i, n) {
          var target = n[i];
          var name = target.getAttribute('data-name');

          var path = _this12._chart._area.select('path[data-name="' + name + '"]').node();

          _this12._fireEvt("elepath_toggle", {
            path: path,
            name: name,
            legend: target
          });
        });
      });
      this.on("eletrack_download", function (e) {
        if (e.downloadLink == 'modal' && typeof CustomEvent === "function") {
          document.dispatchEvent(new CustomEvent("eletrack_download", {
            detail: e
          }));
        } else if (e.downloadLink == 'link' || e.downloadLink === true) {
          e.confirm();
        }
      });
      this.on('eledata_loaded', function (e) {
        var layer = e.layer;

        if (this._map) {
          this._map.once('layeradd', function (e) {
            this.fitBounds(layer.getBounds());
          }, this);

          layer.addTo(this._map);
        } else {
          console.warn("Undefined elevation map object");
        }
      });
    });

    Elevation.addInitHook(function () {
      if (this.options.imperial) {
        this._distanceFactor = this.__mileFactor;
        this._xLabel = "mi";
      } else {
        this._distanceFactor = this.options.distanceFactor;
        this._xLabel = this.options.xLabel;
      }

      this.on("eledata_updated", function (e) {
        var data = this._data;
        var i = e.index;
        var dist = this._distance || 0;
        var curr = data[i].latlng;
        var prev = i > 0 ? data[i - 1].latlng : curr;

        var delta = curr.distanceTo(prev) * this._distanceFactor;

        dist = dist + Math.round(delta / 1000 * 100000) / 100000;
        data[i].dist = dist;
        this.track_info.distance = this._distance = dist;
      });
      this.on("elechart_summary", function () {
        this.track_info.distance = this._distance || 0;
        this.summaryDiv.innerHTML += '<span class="totlen"><span class="summarylabel">' + L._("Total Length: ") + '</span><span class="summaryvalue">' + this.track_info.distance.toFixed(2) + '&nbsp;' + this._xLabel + '</span></span>';
      });
      this.on("eledata_clear", function () {
        this._distance = 0;
      });
    });

    Elevation.addInitHook(function () {
      if (this.options.imperial) {
        this._heightFactor = this.__footFactor;
        this._yLabel = "ft";
      } else {
        this._heightFactor = this.options.heightFactor;
        this._yLabel = this.options.yLabel;
      }

      this.on("eledata_updated", function (e) {
        var data = this._data;
        var i = e.index;
        var z = data[i].z * this._heightFactor;
        var eleMax = this._maxElevation || -Infinity;
        var eleMin = this._minElevation || +Infinity; // check and fix missing elevation data on last added point

        if (!this.options.skipNullZCoords && i > 0) {
          var prevZ = data[i - 1].z;

          if (isNaN(prevZ)) {
            var lastZ = this._lastValidZ;
            var currZ = z;

            if (!isNaN(lastZ) && !isNaN(currZ)) {
              prevZ = (lastZ + currZ) / 2;
            } else if (!isNaN(lastZ)) {
              prevZ = lastZ;
            } else if (!isNaN(currZ)) {
              prevZ = currZ;
            }

            if (!isNaN(prevZ)) data[i - 1].z = prevZ;else data.splice(i - 1, 1);
          }
        } // skip point if it has not elevation


        if (!isNaN(z)) {
          eleMax = eleMax < z ? z : eleMax;
          eleMin = eleMin > z ? z : eleMin;
          this._lastValidZ = z;
        }

        data[i].z = z;
        this.track_info.elevation_max = this._maxElevation = eleMax;
        this.track_info.elevation_min = this._minElevation = eleMin;
      });
      this.on("elechart_legend", function () {
        this._altitudeLegend = this._chart._legend.append('g').call(LegendItem({
          name: 'Altitude',
          width: this._width(),
          height: this._height(),
          margins: this.options.margins
        }));
      });
      this.on("elechart_summary", function () {
        this.track_info.elevation_max = this._maxElevation || 0;
        this.track_info.elevation_min = this._minElevation || 0;
        this.summaryDiv.innerHTML += '<span class="maxele"><span class="summarylabel">' + L._("Max Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_max.toFixed(2) + '&nbsp;' + this._yLabel + '</span></span>' + '<span class="minele"><span class="summarylabel">' + L._("Min Elevation: ") + '</span><span class="summaryvalue">' + this.track_info.elevation_min.toFixed(2) + '&nbsp;' + this._yLabel + '</span></span>';
      });
      this.on("eledata_clear", function () {
        this._maxElevation = null;
        this._minElevation = null;
      });
    });

    Elevation.addInitHook(function () {
      if (!this.options.slope) return;
      var opts = this.options;
      var slope = {};
      opts.margins.right = 50;

      if (this.options.slope != "summary") {
        this.on("elechart_init", function () {
          slope.path = this._chart._area.append('path').style("pointer-events", "none") // TODO: add a class here.
          .attr("fill", "#F00").attr("stroke", "#000").attr("stroke-opacity", "0.5").attr("fill-opacity", "0.25");
        });
        this.on("elechart_axis", function () {
          slope.x = this._chart._x; // slope.x = D3.Scale({
          // 	data: this._data,
          // 	range: [0, this._width()],
          // 	attr: opts.xAttr,
          // 	min: opts.xAxisMin,
          // 	max: opts.xAxisMax,
          // 	forceBounds: opts.forceAxisBounds,
          // });

          slope.y = Scale({
            data: this._data,
            range: [this._height(), 0],
            attr: "slope",
            min: -1,
            max: +1,
            forceBounds: opts.forceAxisBounds
          });
          slope.axis = Axis({
            axis: "y",
            position: "right",
            width: this._width(),
            height: this._height(),
            scale: slope.y,
            ticks: this.options.yTicks,
            tickPadding: 16,
            label: "%",
            labelX: 25,
            labelY: 3
          });

          this._chart._axis.call(slope.axis);
        });
        this.on("elechart_updated", function () {
          slope.area = Area({
            interpolation: opts.sInterpolation,
            data: this._data,
            name: 'Slope',
            xAttr: opts.xAttr,
            yAttr: "slope",
            width: this._width(),
            height: this._height(),
            scaleX: slope.x,
            scaleY: slope.y
          });
          slope.path.call(slope.area);
        });
        this.on("elechart_legend", function () {
          slope.legend = this._chart._legend.append("g").call(LegendItem({
            name: 'Slope',
            width: this._width(),
            height: this._height(),
            margins: this.options.margins
          }));

          this._altitudeLegend.attr("transform", "translate(-50, 0)");

          slope.legend.attr("transform", "translate(50, 0)");
          slope.legend.select("rect").classed("area", false) // TODO: add a class here.
          .attr("fill", "#F00").attr("stroke", "#000").attr("stroke-opacity", "0.5").attr("fill-opacity", "0.25");
        });
      }

      this.on("eledata_updated", function (e) {
        var data = this._data;
        var i = e.index;
        var z = data[i].z;
        var curr = data[i].latlng;
        var prev = i > 0 ? data[i - 1].latlng : curr;

        var delta = curr.distanceTo(prev) * this._distanceFactor; // Slope / Gain


        var tAsc = this._tAsc || 0; // Total Ascent

        var tDes = this._tDes || 0; // Total Descent

        var sMax = this._sMax || 0; // Slope Max

        var sMin = this._sMin || 0; // Slope Min

        var slope = 0;

        if (!isNaN(z)) {
          var deltaZ = i > 0 ? z - data[i - 1].z : 0;
          if (deltaZ > 0) tAsc += deltaZ;else if (deltaZ < 0) tDes -= deltaZ; // slope in % = ( height / length ) * 100

          slope = delta !== 0 ? deltaZ / delta * 100 : 0;
        } // Try to smooth "crazy" slope values.


        if (this.options.sDeltaMax) {
          var deltaS = i > 0 ? slope - data[i - 1].slope : 0;
          var maxDeltaS = this.options.sDeltaMax;

          if (Math.abs(deltaS) > maxDeltaS) {
            slope = data[i - 1].slope + maxDeltaS * Math.sign(deltaS);
          }
        } // Range of acceptable slope values.


        if (this.options.sRange) {
          var range = this.options.sRange;
          if (slope < range[0]) slope = range[0];else if (slope > range[1]) slope = range[1];
        }

        slope = L.Util.formatNum(slope, 2);
        sMax = slope > sMax ? slope : sMax;
        sMin = slope < sMin ? slope : sMin;
        data[i].slope = slope;
        this.track_info.ascent = this._tAsc = tAsc;
        this.track_info.descent = this._tDes = tDes;
        this.track_info.slope_max = this._sMax = sMax;
        this.track_info.slope_min = this._sMin = sMin;
      });
      this.on("elechart_change", function (e) {
        var item = e.data;
        var xCoordinate = e.xCoord;
        var chart = this._chart;

        if (chart._focuslabel) {
          if (!chart._focuslabelSlope || !chart._focuslabelSlope.property('isConnected')) {
            chart._focuslabelSlope = chart._focuslabel.select('text').insert("svg:tspan", ".mouse-focus-label-x").attr("class", "mouse-focus-label-slope").attr("dy", "1.5em");
          }

          chart._focuslabelSlope.text(item.slope + "%");

          chart._focuslabel.select('.mouse-focus-label-x').attr("dy", "1.5em");
        }

        if (chart._mouseHeightFocusLabel) {
          if (!chart._mouseSlopeFocusLabel) {
            chart._mouseSlopeFocusLabel = chart._mouseHeightFocusLabel.append("svg:tspan").attr("class", "height-focus-slope ");
          }

          chart._mouseSlopeFocusLabel.attr("dy", "1.5em").text(Math.round(item.slope) + "%");

          chart._mouseHeightFocusLabel.select('.height-focus-y').attr("dy", "-1.5em");
        }
      });
      this.on("elechart_summary", function () {
        this.track_info.ascent = this._tAsc || 0;
        this.track_info.descent = this._tDes || 0;
        this.track_info.slope_max = this._sMax || 0;
        this.track_info.slope_min = this._sMin || 0;
        this.summaryDiv.querySelector('.minele').insertAdjacentHTML('afterend', '<span class="ascent"><span class="summarylabel">' + L._("Total Ascent: ") + '</span><span class="summaryvalue">' + Math.round(this.track_info.ascent) + '&nbsp;' + this._yLabel + '</span></span>' + '<span class="descent"><span class="summarylabel">' + L._("Total Descent: ") + '</span><span class="summaryvalue">' + Math.round(this.track_info.descent) + '&nbsp;' + this._yLabel + '</span></span>' + '<span class="minslope"><span class="summarylabel">' + L._("Min Slope: ") + '</span><span class="summaryvalue">' + this.track_info.slope_min + '&nbsp;' + '%' + '</span></span>' + '<span class="maxslope"><span class="summarylabel">' + L._("Max Slope: ") + '</span><span class="summaryvalue">' + this.track_info.slope_max + '&nbsp;' + '%' + '</span></span>');
      });
      this.on("eledata_clear", function () {
        this._sMax = null;
        this._sMin = null;
        this._tAsc = null;
        this._tDes = null;
      });
    });

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
    Elevation.Utils = _;
    Elevation.Components = D3;
    Elevation.Chart = Chart;

    L.control.elevation = function (options) {
      return new Elevation(options);
    };

})));
//# sourceMappingURL=leaflet-elevation.js.map
