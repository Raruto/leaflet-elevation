L.Control.Elevation = L.Control.extend({
  options: {
    autohide: true,
    autohidePositionMarker: true,
    collapsed: false,
    controlButton: {
      iconCssClass: "elevation-toggle-icon",
      title: "Elevation"
    },
    detachedView: false,
    distanceFactor: 1,
    elevationDiv: "#elevation-div",
    followPositionMarker: false,
    forceAxisBounds: false,
    gpxOptions: {
      async: true,
      marker_options: {
        startIconUrl: null,
        endIconUrl: null,
        shadowUrl: null,
      },
      polyline_options: {
        className: '',
        color: '#566B13',
        opacity: 0.75,
        weight: 5,
        lineCap: 'round'
      },
    },
    height: 175,
    heightFactor: 1,
    hoverNumber: {
      decimalsX: 2,
      decimalsY: 0,
      formatter: undefined
    },
    imperial: false,
    interpolation: d3.curveLinear,
    position: "topright",
    theme: "lime-theme",
    margins: {
      top: 10,
      right: 20,
      bottom: 30,
      left: 50
    },
    responsiveView: true,
    useHeightIndicator: true,
    useLeafletMarker: false,
    useMapIndicator: true,
    width: 600,
    xLabel: "km",
    xTicks: undefined,
    yAxisMax: undefined,
    yAxisMin: undefined,
    yLabel: "m",
    yTicks: undefined,
    zFollow: 13,
  },
  __mileFactor: 0.621371,
  __footFactor: 3.28084,

  /*
   * Add data to the diagram either from GPX or GeoJSON and update the axis domain and data
   */
  addData: function(d, layer) {
    this._addData(d);
    if (this._container) {
      this._applyData();
    }
    if ((typeof layer === "undefined" || layer === null) && d.on) {
      layer = d;
    }
    if (layer) {
      if (layer._path) {
        L.DomUtil.addClass(layer._path, 'elevation-polyline ' + this.options.theme);
      }
      layer
        .on("mousemove", this._mousemoveLayerHandler, this)
        .on("mouseout", this._mouseoutHandler, this);
    }

    this.track_info = this.track_info || {};
    this.track_info.distance = this._distance;
    this.track_info.elevation_max = this._maxElevation;
    this.track_info.elevation_min = this._minElevation;

    this._layers = this._layers || {};
    this._layers[layer._leaflet_id] = layer;

    this._map.fireEvent("eledata_added", {
      data: d,
      layer: layer,
      track_info: this.track_info,
    }, true);
  },

  addTo: function(map) {
    if (this.options.detachedView) {
      this._addToChartDiv(map);
    } else {
      L.Control.prototype.addTo.call(this, map);
    }
  },

  /*
   * Reset data and display
   */
  clear: function() {

    for (var id in this._layers) {
      L.DomUtil.removeClass(this._layers[id]._path, "elevation-polyline");
      L.DomUtil.removeClass(this._layers[id]._path, this.options.theme);
    }

    this._clearData();

    if (this._areapath) {
      // workaround for 'Error: Problem parsing d=""' in Webkit when empty data
      // https://groups.google.com/d/msg/d3-js/7rFxpXKXFhI/HzIO_NPeDuMJ
      //this._areapath.datum(this._data).attr("d", this._area);
      this._areapath.attr("d", "M0 0");

      this._x.domain([0, 1]);
      this._y.domain([0, 1]);
      this._updateAxis();
    }
    if (this._map) {
      this._map.fireEvent("eledata_clear");
    }
  },

  disableDragging: function() {
    this._draggingEnabled = false;
    this._resetDrag();
  },

  enableDragging: function() {
    this._draggingEnabled = true;
  },

  fitBounds: function() {
    this._map.fitBounds(this._fullExtent);
  },

  getZFollow: function() {
    return this._zFollow;
  },

  hide: function() {
    this._container.style.display = "none";
  },

  /**
   * Alias for addTo
   */
  loadChart: function(map) {
    this.addTo(map);
  },

  loadData: function(data) {
    if (this._isXMLDoc(data)) {
      this.loadGPX(data);
    } else if (this._isJSONDoc(data)) {
      this.loadGeoJSON(data);
    } else {
      this.loadFile(data);
    }
  },

  loadFile: function(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.responseType = "text";
      xhr.open('GET', url);
      xhr.onload = function() {
        if (xhr.status !== 200) {
          throw "Error " + xhr.status + " while fetching remote file: " + url;
        } else {
          this.loadData(xhr.response);
        }
      }.bind(this);
      xhr.send();
    } catch (e) {
      console.warn(e);
    }
  },

  loadGeoJSON: function(data) {
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    this.geojson = L.geoJson(data, {
      style: function(feature) {
        return {
          color: '#566B13',
          className: 'elevation-polyline ' + this.options.theme,
        };
      }.bind(this),
      onEachFeature: function(feature, layer) {
        this.addData(feature, layer);

        this.track_info = this.track_info || {};
        this.track_info.type = "geojson";
        this.track_info.name = data.name;
        this.track_info.distance = this._distance;
        this.track_info.elevation_max = this._maxElevation;
        this.track_info.elevation_min = this._minElevation;

      }.bind(this),
    });

    this._map.once('layeradd', function(e) {
      this._map.fitBounds(this.geojson.getBounds());

      this._map.fireEvent("eledata_loaded", {
        data: data,
        layer: this.geojson,
        name: this.track_info.name,
        track_info: this.track_info,
      }, true);
    }, this);

    this.geojson.addTo(this._map);
  },

  loadGPX: function(data) {
    this.options.gpxOptions.polyline_options.className += 'elevation-polyline ' + this.options.theme;

    this.gpx = new L.GPX(data, this.options.gpxOptions);

    this.gpx.on('loaded', function(e) {
      this._map.fitBounds(e.target.getBounds());
    }, this);
    this.gpx.once("addline", function(e) {
      this.addData(e.line, this.gpx);

      this.track_info = this.track_info || {};
      this.track_info.type = "gpx";
      this.track_info.name = this.gpx.get_name();
      this.track_info.distance = this._distance;
      this.track_info.elevation_max = this._maxElevation;
      this.track_info.elevation_min = this._minElevation;

      this._map.fireEvent("eledata_loaded", {
        data: data,
        layer: this.gpx,
        name: this.track_info.name,
        track_info: this.track_info,
      }, true);
    }, this);

    this.gpx.addTo(this._map);
  },

  initialize: function(options) {
    this.options.autohide = typeof options.autohide !== "undefined" ? options.autohide : !L.Browser.mobile;

    L.Util.setOptions(this, options);

    this._draggingEnabled = !L.Browser.mobile;

    if (options.imperial) {
      this._distanceFactor = this.__mileFactor;
      this._heightFactor = this.__footFactor;
      this._xLabel = "mi";
      this._yLabel = "ft";
    } else {
      this._distanceFactor = this.options.distanceFactor;
      this._heightFactor = this.options.heightFactor;
      this._xLabel = this.options.xLabel;
      this._yLabel = this.options.yLabel;
    }

    this._zFollow = this.options.zFollow;
  },

  onAdd: function(map) {
    this._map = map;

    var opts = this.options;

    var container = this._container = L.DomUtil.create("div", "elevation");
    L.DomUtil.addClass(container, 'leaflet-control ' + opts.theme); //append theme to control

    this._initToggle(container);
    this._initChart(container);

    this._applyData();

    this._map.on('zoom viewreset zoomanim', this._hidePositionMarker, this);
    this._map.on('resize', this._resetView, this);
    this._map.on('resize', this._resizeChart, this);
    this._map.on('mousedown', this._resetDrag, this);

    L.DomEvent.on(this._map._container, 'mousewheel', this._resetDrag, this);
    L.DomEvent.on(this._map._container, 'touchstart', this._resetDrag, this);

    return container;
  },

  onRemove: function(map) {
    this._container = null;
  },

  setZFollow: function(zoom) {
    this._zFollow = zoom;
  },

  show: function() {
    this._container.style.display = "block";
  },

  /*
   * Parsing data either from GPX or GeoJSON and update the diagram data
   */
  _addData: function(d) {
    var geom = d && d.geometry && d.geometry;
    var i;

    if (geom) {
      switch (geom.type) {
        case 'LineString':
          this._addGeoJSONData(geom.coordinates);
          break;

        case 'MultiLineString':
          for (i = 0; i < geom.coordinates.length; i++) {
            this._addGeoJSONData(geom.coordinates[i]);
          }
          break;

        default:
          console.warn('Unsopperted GeoJSON feature geometry type:' + geom.type);
      }
    }

    var feat = d && d.type === "FeatureCollection";
    if (feat) {
      for (i = 0; i < d.features.length; i++) {
        this._addData(d.features[i]);
      }
    }

    if (d && d._latlngs) {
      this._addGPXdata(d._latlngs);
    }
  },

  /*
   * Parsing of GeoJSON data lines and their elevation in z-coordinate
   */
  _addGeoJSONData: function(coords) {
    if (coords) {
      for (var i = 0; i < coords.length; i++) {
        this._addPoint(coords[i][1], coords[i][0], coords[i][2]);
      }
    }
  },

  /*
   * Parsing function for GPX data and their elevation in z-coordinate
   */
  _addGPXdata: function(coords) {
    if (coords) {
      for (var i = 0; i < coords.length; i++) {
        this._addPoint(coords[i].lat, coords[i].lng, coords[i].meta.ele);
      }
    }
  },

  _addPoint: function(x, y, z) {
    var opts = this.options;

    var data = this._data || [];
    var eleMax = this._maxElevation || -Infinity;
    var eleMin = this._minElevation || +Infinity;
    var dist = this._distance || 0;

    var curr = new L.LatLng(x, y);
    var prev = data.length ? data[data.length - 1].latlng : curr;

    var delta = curr.distanceTo(prev) * this._distanceFactor;

    dist = dist + Math.round(delta / 1000 * 100000) / 100000;

    // skip point if it has not elevation
    if (typeof z !== "undefined") {
      eleMax = eleMax < z ? z : eleMax;
      eleMin = eleMin > z ? z : eleMin;
      data.push({
        dist: dist,
        x: x,
        y: y,
        z: z * this._heightFactor,
        latlng: curr
      });
    }

    this._data = data;
    this._distance = dist;
    this._maxElevation = eleMax * this._heightFactor;
    this._minElevation = eleMin * this._heightFactor;
  },

  _addToChartDiv: function(map) {
    var container = this.onAdd(map);
    var eleDiv = document.querySelector(this.options.elevationDiv);
    eleDiv.appendChild(container);
  },

  _appendChart: function(svg) {
    var g = svg
      .append("g")
      .attr("transform", "translate(" + this.options.margins.left + "," + this.options.margins.top + ")");

    this._appendGrid(g);
    this._appendAreaPath(g);
    this._appendAxis(g);
    this._appendFocusRect(g);
    this._appendMouseFocusG(g);
  },

  _appendXaxis: function(axis) {
    axis
      .append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + this._height() + ")")
      .call(
        d3
        .axisBottom()
        .scale(this._x)
        .ticks(this.options.xTicks)
      )
      .append("text")
      .attr("x", this._width() + 6)
      .attr("y", 30)
      .text(this._xLabel);
  },

  _appendXGrid: function(grid) {
    grid.append("g")
      .attr("class", "x grid")
      .attr("transform", "translate(0," + this._height() + ")")
      .call(
        d3
        .axisBottom()
        .scale(this._x)
        .ticks(this.options.xTicks)
        .tickSize(-this._height())
        .tickFormat("")
      );

  },

  _appendYaxis: function(axis) {
    axis
      .append("g")
      .attr("class", "y axis")
      .call(
        d3
        .axisLeft()
        .scale(this._y)
        .ticks(this.options.yTicks)
      )
      .append("text")
      .attr("x", -30)
      .attr("y", 3)
      .text(this._yLabel);
  },

  _appendYGrid: function(grid) {
    grid.append("g")
      .attr("class", "y grid")
      .call(
        d3
        .axisLeft()
        .scale(this._y)
        .ticks(this.options.yTicks)
        .tickSize(-this._width())
        .tickFormat("")
      );
  },

  _appendAreaPath: function(g) {
    this._areapath = g.append("path")
      .attr("class", "area");
  },

  _appendAxis: function(g) {
    this._axis = g.append("g")
      .attr("class", "axis");
    this._appendXaxis(this._axis);
    this._appendYaxis(this._axis);
  },

  _appendFocusRect: function(g) {
    var focusRect = this._focusRect = g.append("rect")
      .attr("width", this._width())
      .attr("height", this._height())
      .style("fill", "none")
      .style("stroke", "none")
      .style("pointer-events", "all");

    if (L.Browser.mobile) {
      focusRect
        .on("touchmove.drag", this._dragHandler.bind(this))
        .on("touchstart.drag", this._dragStartHandler.bind(this))
        .on("touchstart.focus", this._mousemoveHandler.bind(this))
        .on("touchmove.focus", this._mousemoveHandler.bind(this));
      L.DomEvent.on(this._container, 'touchend', this._dragEndHandler, this);
    }

    focusRect
      .on("mousemove.drag", this._dragHandler.bind(this))
      .on("mousedown.drag", this._dragStartHandler.bind(this))
      .on("mousemove.focus", this._mousemoveHandler.bind(this))
      .on("mouseout.focus", this._mouseoutHandler.bind(this));
    L.DomEvent.on(this._container, 'mouseup', this._dragEndHandler, this);
  },

  _appendGrid: function(g) {
    this._grid = g.append("g")
      .attr("class", "grid");
    this._appendXGrid(this._grid);
    this._appendYGrid(this._grid);
  },

  _appendMouseFocusG: function(g) {
    var focusG = this._focusG = g.append("g")
      .attr("class", "mouse-focus-group");

    this._mousefocus = focusG.append('svg:line')
      .attr('class', 'mouse-focus-line')
      .attr('x2', '0')
      .attr('y2', '0')
      .attr('x1', '0')
      .attr('y1', '0');

    this._focuslabelrect = focusG.append("rect")
      .attr('class', 'mouse-focus-label')
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 0)
      .attr("height", 0)
      .attr("rx", 3)
      .attr("ry", 3);

    this._focuslabeltext = focusG.append("svg:text")
      .attr("class", "mouse-focus-label-text");
    this._focuslabelY = this._focuslabeltext.append("svg:tspan")
      .attr("class", "mouse-focus-label-y")
      .attr("dy", "-1em");
    this._focuslabelX = this._focuslabeltext.append("svg:tspan")
      .attr("class", "mouse-focus-label-x")
      .attr("dy", "2em");
  },

  _appendPositionMarker: function(pane) {
    var theme = this.options.theme;
    var heightG = pane.append("g");

    this._mouseHeightFocus = heightG.append('svg:line')
      .attr("class", theme + " height-focus line")
      .attr("x2", 0)
      .attr("y2", 0)
      .attr("x1", 0)
      .attr("y1", 0);

    this._pointG = heightG.append("g");
    this._pointG.append("svg:circle")
      .attr("class", theme + " height-focus circle-lower")
      .attr("r", 6)
      .attr("cx", 0)
      .attr("cy", 0);

    this._mouseHeightFocusLabel = heightG.append("svg:text")
      .attr("class", theme + " height-focus-label")
      .style("pointer-events", "none");
  },

  _applyData: function() {
    if (!this._data) return;

    var xdomain = d3.extent(this._data, function(d) {
      return d.dist;
    });
    var ydomain = d3.extent(this._data, function(d) {
      return d.z;
    });
    var opts = this.options;

    if (opts.yAxisMin !== undefined && (opts.yAxisMin < ydomain[0] || opts.forceAxisBounds)) {
      ydomain[0] = opts.yAxisMin;
    }
    if (opts.yAxisMax !== undefined && (opts.yAxisMax > ydomain[1] || opts.forceAxisBounds)) {
      ydomain[1] = opts.yAxisMax;
    }

    this._x.domain(xdomain);
    this._y.domain(ydomain);
    this._areapath.datum(this._data)
      .attr("d", this._area);
    this._updateAxis();

    this._fullExtent = this._calculateFullExtent(this._data);
  },

  /*
   * Calculates the full extent of the data array
   */
  _calculateFullExtent: function(data) {
    if (!data || data.length < 1) {
      throw new Error("no data in parameters");
    }

    var ext = new L.latLngBounds(data[0].latlng, data[0].latlng);

    data.forEach(function(item) {
      ext.extend(item.latlng);
    });

    return ext;
  },

  /*
   * Reset data
   */
  _clearData: function() {
    this._data = null;
    this._distance = null;
    this._maxElevation = null;
    this._minElevation = null;
    this.track_info = null;
    this._layers = null;
    // if (this.gpx) {
    // 	this.gpx.removeFrom(this._map);
    // }
  },

  _collapse: function() {
    if (this._container) {
      L.DomUtil.removeClass(this._container, 'elevation-expanded');
      L.DomUtil.addClass(this._container, 'elevation-collapsed');
    }
  },

  _dragHandler: function() {
    //we don't want map events to occur here
    d3.event.preventDefault();
    d3.event.stopPropagation();

    this._gotDragged = true;
    this._drawDragRectangle();
  },

  /*
   * Handles end of drag operations. Zooms the map to the selected items extent.
   */
  _dragEndHandler: function() {
    if (!this._dragStartCoords || !this._dragCurrentCoords || !this._gotDragged) {
      this._dragStartCoords = null;
      this._gotDragged = false;
      if (this._draggingEnabled)
        this._resetDrag();
      return;
    }

    var item1 = this._findItemForX(this._dragStartCoords[0]),
      item2 = this._findItemForX(this._dragCurrentCoords[0]);

    if (item1 == item2) return;

    this._hidePositionMarker();

    this._fitSection(item1, item2);

    this._dragStartCoords = null;
    this._gotDragged = false;

    this._map.fireEvent("elechart_dragged", {
      data: {
        dragstart: this._data[item1],
        dragend: this._data[item2]
      }
    }, true);
  },

  _dragStartHandler: function() {
    d3.event.preventDefault();
    d3.event.stopPropagation();

    this._gotDragged = false;
    this._dragStartCoords = d3.mouse(this._focusRect.node());
  },

  /*
   * Draws the currently dragged rectangle over the chart.
   */
  _drawDragRectangle: function() {
    if (!this._dragStartCoords || !this._draggingEnabled) {
      return;
    }

    var dragEndCoords = this._dragCurrentCoords = d3.mouse(this._focusRect.node());

    var x1 = Math.min(this._dragStartCoords[0], dragEndCoords[0]),
      x2 = Math.max(this._dragStartCoords[0], dragEndCoords[0]);

    if (!this._dragRectangle && !this._dragRectangleG) {
      var g = d3.select(this._container).select("svg").select("g");

      this._dragRectangleG = g.insert("g", ".mouse-focus-group");

      this._dragRectangle = this._dragRectangleG.append("rect")
        .attr("width", x2 - x1)
        .attr("height", this._height())
        .attr("x", x1)
        .attr('class', 'mouse-drag')
        .style("pointer-events", "none");
    } else {
      this._dragRectangle.attr("width", x2 - x1)
        .attr("x", x1);
    }
  },

  _expand: function() {
    if (this._container) {
      L.DomUtil.removeClass(this._container, 'elevation-collapsed');
      L.DomUtil.addClass(this._container, 'elevation-expanded');
    }
  },

  /*
   * Finds an item with the smallest delta in distance to the given latlng coords
   */
  _findItemForLatLng: function(latlng) {
    var result = null,
      d = Infinity;
    this._data.forEach(function(item) {
      var dist = latlng.distanceTo(item.latlng);
      if (dist < d) {
        d = dist;
        result = item;
      }
    });
    return result;
  },

  /*
   * Finds a data entry for a given x-coordinate of the diagram
   */
  _findItemForX: function(x) {
    var bisect = d3.bisector(function(d) {
      return d.dist;
    }).left;
    var xinvert = this._x.invert(x);
    return bisect(this._data, xinvert);
  },

  /**
   * Make the map fit the route section between given indexes.
   */
  _fitSection: function(index1, index2) {
    var start = Math.min(index1, index2),
      end = Math.max(index1, index2);

    var ext = this._calculateFullExtent(this._data.slice(start, end));

    this._map.fitBounds(ext);
  },

  /*
   * Fromatting funciton using the given decimals and seperator
   */
  _formatter: function(num, dec, sep) {
    var res;
    if (dec === 0) {
      res = Math.round(num) + "";
    } else {
      res = L.Util.formatNum(num, dec) + "";
    }
    var numbers = res.split(".");
    if (numbers[1]) {
      var d = dec - numbers[1].length;
      for (; d > 0; d--) {
        numbers[1] += "0";
      }
      res = numbers.join(sep || ".");
    }
    return res;
  },

  _height: function() {
    var opts = this.options;
    return opts.height - opts.margins.top - opts.margins.bottom;
  },

  /*
   * Hides the position/height indicator marker drawn onto the map
   */
  _hidePositionMarker: function() {
    if (!this.options.autohidePositionMarker) {
      return;
    }

    this._selectedItem = null;

    if (this._marker) {
      this._map.removeLayer(this._marker);
      this._marker = null;
    }
    if (this._mouseHeightFocus) {
      this._mouseHeightFocus.style("visibility", "hidden");
      this._mouseHeightFocusLabel.style("visibility", "hidden");
    }
    if (this._pointG) {
      this._pointG.style("visibility", "hidden");
    }
    this._focusG.style("visibility", "hidden");
  },

  _initChart: function() {
    var opts = this.options;
    opts.xTicks = opts.xTicks || Math.round(this._width() / 75);
    opts.yTicks = opts.yTicks || Math.round(this._height() / 30);
    opts.hoverNumber.formatter = opts.hoverNumber.formatter || this._formatter;

    if (opts.responsiveView) {
      if (opts.detachedView) {
        var offsetWi = document.querySelector(opts.elevationDiv).offsetWidth;
        var offsetHe = document.querySelector(opts.elevationDiv).offsetHeight;
        opts.width = offsetWi > 0 ? offsetWi : opts.width;
        opts.height = (offsetHe - 20) > 0 ? offsetHe - 20 : opts.height - 20;
      } else {
        opts._maxWidth = opts._maxWidth > opts.width ? opts._maxWidth : opts.width;
        var containerWidth = this._map._container.clientWidth;
        opts.width = opts._maxWidth > containerWidth ? containerWidth - 30 : opts.width;
      }
    }

    var x = this._x = d3.scaleLinear().range([0, this._width()]);
    var y = this._y = d3.scaleLinear().range([this._height(), 0]);

    var area = this._area = d3.area().curve(opts.interpolation)
      .x(function(d) {
        return (d.xDiagCoord = x(d.dist));
      })
      .y0(this._height())
      .y1(function(d) {
        return y(d.z);
      });
    var line = this._line = d3.line()
      .x(function(d) {
        return d3.mouse(svg.select("g"))[0];
      })
      .y(function(d) {
        return this._height();
      });

    var container = this._container;

    var cont = d3.select(container)
      .attr("width", opts.width);

    var svg = cont.append("svg")
      .attr("class", "background")
      .attr("width", opts.width)
      .attr("height", opts.height);

    this._appendChart(svg);
  },

  /**
   * Inspired by L.Control.Layers
   */
  _initToggle: function(container) {
    //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
    container.setAttribute('aria-haspopup', true);

    if (!this.options.detachedView) {
      L.DomEvent
        .disableClickPropagation(container);
      //.disableScrollPropagation(container);
    }

    if (L.Browser.mobile) {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    }

    L.DomEvent.on(container, 'mousewheel', this._mousewheelHandler, this);

    if (!this.options.detachedView) {
      var iconCssClass = "elevation-toggle " + this.options.controlButton.iconCssClass + (this.options.autohide ? "" : " close-button");
      var link = this._button = L.DomUtil.create('a', iconCssClass, container);
      link.href = '#';
      link.title = this.options.controlButton.title;

      if (this.options.collapsed) {
        this._collapse();
        if (this.options.autohide) {
          L.DomEvent
            .on(container, 'mouseover', this._expand, this)
            .on(container, 'mouseout', this._collapse, this);
        } else {
          L.DomEvent
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', this._toggle, this);
        }

        L.DomEvent.on(link, 'focus', this._toggle, this);

        this._map.on('click', this._collapse, this);
        // TODO: keyboard accessibility
      }
    } else {
      // TODO: handle autohide when detachedView=true
    }
  },

  _isJSONDoc: function(doc, lazy) {
    lazy = typeof lazy === "undefined" ? true : lazy;
    if (typeof doc === "string" && lazy) {
      doc = doc.trim();
      return doc.indexOf("{") == 0 || doc.indexOf("[") == 0;
    } else {
      try {
        doc = doc.toString();
        JSON.parse(doc);
      } catch (e) {
        console.warn(e);
        return false;
      }
      return true;
    }
  },

  _isXMLDoc: function(doc, lazy) {
    lazy = typeof lazy === "undefined" ? true : lazy;
    if (typeof doc === "string" && lazy) {
      doc = doc.trim();
      return doc.indexOf("<") == 0;
    } else {
      var documentElement = (doc ? doc.ownerDocument || doc : 0).documentElement;
      return documentElement ? documentElement.nodeName !== "HTML" : false;
    }
  },

  _isDomVisible: function(elem) {
    return !!(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length);
  },

  /*
   * Handles the moueseover the chart and displays distance and altitude level
   */
  _mousemoveHandler: function(d, i, ctx) {
    if (!this._data || this._data.length === 0) {
      return;
    }
    var coords = d3.mouse(this._focusRect.node());
    var xCoord = coords[0];
    var item = this._data[this._findItemForX(xCoord)];

    this._hidePositionMarker();
    this._showDiagramIndicator(item, xCoord);
    this._showPositionMarker(item);

    if (this.options.followPositionMarker) {
      var zoom = this._map.getZoom();
      zoom = zoom < this._zFollow ? this._zFollow : zoom;
      this._map.setView(item.latlng, zoom);
    }

    this._map.fireEvent("elechart_change", {
      data: item
    }, true);

  },

  /*
   * Handles mouseover events of the data layers on the map.
   */
  _mousemoveLayerHandler: function(e) {
    if (!this._data || this._data.length === 0) {
      return;
    }
    var latlng = e.latlng;
    var item = this._findItemForLatLng(latlng);
    if (item) {
      var x = item.xDiagCoord;

      this._hidePositionMarker();
      this._showDiagramIndicator(item, x);
      this._showPositionMarker(item);
    }
  },

  _mouseoutHandler: function() {
    if (!this.options.detachedView) {
      this._hidePositionMarker();
    }
  },

  _mousewheelHandler: function(e) {
    var ll = this._selectedItem ? this._selectedItem.latlng : this._map.getCenter();
    var z = e.deltaY > 0 ? this._map.getZoom() - 1 : this._map.getZoom() + 1;
    this._resetDrag();
    this._map.flyTo(ll, z);
  },

  /*
   * Removes the drag rectangle and zoms back to the total extent of the data.
   */
  _resetDrag: function() {
    if (this._dragRectangleG) {
      this._dragRectangleG.remove();
      this._dragRectangleG = null;
      this._dragRectangle = null;
      this._hidePositionMarker();
    }
  },

  _resetView: function() {
    this._resetDrag();
    this._hidePositionMarker();
    this._map.fitBounds(this._fullExtent);
  },

  _resizeChart: function() {
    if (this.options.responsiveView) {
      if (this.options.detachedView) {
        var eleDiv = document.querySelector(this.options.elevationDiv);
        var newWidth = eleDiv.offsetWidth; // - 20;

        if (newWidth <= 0) return;

        this.options.width = newWidth;
        eleDiv.innerHTML = "";

        var container = this.onAdd(this._map);

        eleDiv.appendChild(container);
      } else {
        this._map.removeControl(this._container);
        this.addTo(this._map);
      }
    }
  },

  _showDiagramIndicator: function(item, xCoordinate) {
    var opts = this.options;
    this._focusG.style("visibility", "visible");

    this._mousefocus.attr('x1', xCoordinate)
      .attr('y1', 0)
      .attr('x2', xCoordinate)
      .attr('y2', this._height())
      .classed('hidden', false);

    var alt = item.z,
      dist = item.dist,
      ll = item.latlng,
      numY = opts.hoverNumber.formatter(alt, opts.hoverNumber.decimalsY),
      numX = opts.hoverNumber.formatter(dist, opts.hoverNumber.decimalsX);

    this._focuslabeltext
      // .attr("x", xCoordinate)
      .attr("y", this._y(item.z))
      .style("font-weight", "700");

    this._focuslabelX
      .text(numX + " " + this._xLabel)
      .attr("x", xCoordinate + 10);

    this._focuslabelY
      .text(numY + " " + this._yLabel)
      .attr("x", xCoordinate + 10);

    var focuslabeltext = this._focuslabeltext.node();
    if (this._isDomVisible(focuslabeltext)) {
      var bbox = focuslabeltext.getBBox();
      var padding = 2;

      this._focuslabelrect
        .attr("x", bbox.x - padding)
        .attr("y", bbox.y - padding)
        .attr("width", bbox.width + (padding * 2))
        .attr("height", bbox.height + (padding * 2));

      // move focus label to left
      if (xCoordinate >= this._width() / 2) {
        this._focuslabelrect.attr("x", this._focuslabelrect.attr("x") - this._focuslabelrect.attr("width") - (padding * 2) - 10);
        this._focuslabelX.attr("x", this._focuslabelX.attr("x") - this._focuslabelrect.attr("width") - (padding * 2) - 10);
        this._focuslabelY.attr("x", this._focuslabelY.attr("x") - this._focuslabelrect.attr("width") - (padding * 2) - 10);
      }
    }

  },

  _toggle: function() {
    if (L.DomUtil.hasClass(this._container, "elevation-expanded"))
      this._collapse();
    else
      this._expand();
  },

  _showPositionMarker: function(item) {
    this._selectedItem = item;
    if (this.options.useLeafletMarker) {
      this._updateLeafletMarker(item);
    } else {
      this._updatePositionMarker(item);
    }
  },

  _updateAxis: function() {
    this._grid.selectAll("g").remove();
    this._axis.selectAll("g").remove();
    this._appendXGrid(this._grid);
    this._appendYGrid(this._grid);
    this._appendXaxis(this._axis);
    this._appendYaxis(this._axis);
  },

  _updateHeightIndicator: function(item) {
    var opts = this.options;

    var numY = opts.hoverNumber.formatter(item.z, opts.hoverNumber.decimalsY),
      numX = opts.hoverNumber.formatter(item.dist, opts.hoverNumber.decimalsX);

    var normalizedAlt = this._height() / this._maxElevation * item.z,
      normalizedY = item.y - normalizedAlt;

    this._mouseHeightFocus
      .attr("x1", item.x)
      .attr("x2", item.x)
      .attr("y1", item.y)
      .attr("y2", normalizedY)
      .style("visibility", "visible");

    this._mouseHeightFocusLabel
      .attr("x", item.x)
      .attr("y", normalizedY)
      .text(numY + " " + this._yLabel)
      .style("visibility", "visible");
  },

  _updateLeafletMarker: function(item) {
    var ll = item.latlng;

    if (!this._marker) {
      this._marker = new L.Marker(ll);
      this._marker.addTo(this._map);
    } else {
      this._marker.setLatLng(ll);
    }
  },

  _updatePointG: function(item) {
    this._pointG
      .attr("transform", "translate(" + item.x + "," + item.y + ")")
      .style("visibility", "visible");
  },

  _updatePositionMarker: function(item) {
    var point = this._map.latLngToLayerPoint(item.latlng);
    var layerpoint = {
      dist: item.dist,
      x: point.x,
      y: point.y,
      z: item.z,
    };

    if (!this._mouseHeightFocus) {
      var layerpane = d3.select(this._map.getContainer()).select(".leaflet-overlay-pane svg");
      this._appendPositionMarker(layerpane);
    }

    if (this.options.useMapIndicator) {
      this._updatePointG(layerpoint);
    }

    if (this.options.useHeightIndicator) {
      this._updateHeightIndicator(layerpoint);
    }
  },

  _width: function() {
    var opts = this.options;
    return opts.width - opts.margins.left - opts.margins.right;
  },

});

L.control.elevation = function(options) {
  return new L.Control.Elevation(options);
};
