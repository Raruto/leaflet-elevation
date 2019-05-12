L.Control.Elevation = L.Control.extend({
  options: {
    position: "topright",
    theme: "lime-theme",
    width: 600,
    height: 175,
    margins: {
      top: 10,
      right: 20,
      bottom: 30,
      left: 50
    },
    useHeightIndicator: true,
    autoHideHeightIndicator: false,
    interpolation: d3.curveLinear,
    hoverNumber: {
      decimalsX: 2,
      decimalsY: 0,
      formatter: undefined
    },
    xTicks: undefined,
    yTicks: undefined,
    collapsed: false,
    yAxisMin: undefined,
    yAxisMax: undefined,
    forceAxisBounds: false,
    controlButton: {
      iconCssClass: "elevation-toggle-icon",
      title: "Elevation"
    },
    imperial: false,
    elevationDiv: "#elevation-div",
    detachedView: false,
    responsiveView: true,
    gpxOptions: {
      async: true,
      marker_options: {
        startIconUrl: null,
        endIconUrl: null,
        shadowUrl: null,
      },
      polyline_options: {
        color: '#FF005E',
        opacity: 0.75,
        weight: 5,
        lineCap: 'round'
      },
    },
  },
  __mileFactor: 0.621371,
  __footFactor: 3.28084,

  onRemove: function(map) {
    this._container = null;
  },

  onAdd: function(map) {
    this._map = map;

    var opts = this.options;
    var margin = opts.margins;
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
        var containerWidth = map._container.clientWidth;
        opts.width = opts._maxWidth > containerWidth ? containerWidth - 30 : opts.width;
      }
    }

    var x = this._x = d3.scaleLinear()
      .range([0, this._width()]);

    var y = this._y = d3.scaleLinear()
      .range([this._height(), 0]);

    var area = this._area = d3.area()
      .curve(opts.interpolation)
      .x(function(d) {
        var xDiagCoord = x(d.dist);
        d.xDiagCoord = xDiagCoord;
        return xDiagCoord;
      })
      .y0(this._height())
      .y1(function(d) {
        return y(d.altitude);
      });

    var container = this._container = L.DomUtil.create("div", "elevation");
    L.DomUtil.addClass(container, opts.theme); //append theme to control

    this._initToggle();

    var cont = d3.select(container);
    cont.attr("width", opts.width);
    var svg = cont.append("svg");
    svg.attr("width", opts.width)
      .attr("class", "background")
      .attr("height", opts.height)
      .style("overflow", "visible")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var line = d3.line();
    line = line
      .x(function(d) {
        return d3.mouse(svg.select("g"))[0];
      })
      .y(function(d) {
        return this._height();
      });

    var g = d3.select(this._container).select("svg").select("g");

    this._areapath = g.append("path")
      .attr("class", "area")
      .style("paint-order", "stroke fill");

    var background = this._background = g.append("rect")
      .attr("width", this._width())
      .attr("height", this._height())
      .style("fill", "none")
      .style("stroke", "none")
      .style("pointer-events", "all");

    if (L.Browser.touch) {
      background
        .on("touchmove.drag", this._dragHandler.bind(this))
        .on("touchstart.drag", this._dragStartHandler.bind(this))
        .on("touchstart.focus", this._mousemoveHandler.bind(this));
      L.DomEvent.on(this._container, 'touchend', this._dragEndHandler, this);
    }

    background
      .on("mousemove.drag", this._dragHandler.bind(this))
      .on("mousedown.drag", this._dragStartHandler.bind(this))
      .on("mousemove.focus", this._mousemoveHandler.bind(this))
      .on("mouseout.focus", this._mouseoutHandler.bind(this));
    L.DomEvent.on(this._container, 'mouseup', this._dragEndHandler, this);

    this._xaxisgraphicnode = g.append("g");
    this._yaxisgraphicnode = g.append("g");
    this._appendXaxis(this._xaxisgraphicnode);
    this._appendYaxis(this._yaxisgraphicnode);

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
      .attr("ry", 3)
      .style("fill", "#000")
      .style("fill-opacity", 0.75)
      .style("pointer-events", "none");

    this._focuslabeltext = focusG.append("svg:text")
      .style("pointer-events", "none")
      .attr("class", "mouse-focus-label-text")
      .style("fill", "#fff");
    this._focuslabelX = this._focuslabeltext.append("svg:tspan")
      .attr("class", "mouse-focus-label-y")
      .attr("dy", "-1em");
    this._focuslabelY = this._focuslabeltext.append("svg:tspan")
      .attr("class", "mouse-focus-label-y")
      .attr("dy", "2em");

    if (this._data) {
      this._applyData();
    }

    this._map.on('zoom viewreset zoomanim', this._forceHidePositionMarker, this);
    this._map.on('resize', this._resetView, this);
    this._map.on('resize', this._resizeChart, this);

    return container;
  },

  _dragHandler: function() {
    //we donÂ´t want map events to occur here
    d3.event.preventDefault();
    d3.event.stopPropagation();

    this._gotDragged = true;
    this._drawDragRectangle();
  },

  _dragStartHandler: function() {
    d3.event.preventDefault();
    d3.event.stopPropagation();

    this._gotDragged = false;
    this._dragStartCoords = d3.mouse(this._background.node());
  },

  /*
   * Draws the currently dragged rectangle over the chart.
   */
  _drawDragRectangle: function() {
    if (!this._dragStartCoords) {
      return;
    }

    var dragEndCoords = this._dragCurrentCoords = d3.mouse(this._background.node());

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

  /*
   * Handles end of dragg operations. Zooms the map to the selected items extent.
   */
  _dragEndHandler: function() {
    if (!this._dragStartCoords || !this._gotDragged) {
      this._dragStartCoords = null;
      this._gotDragged = false;
      //this._resetDrag();
      return;
    }

    this._hidePositionMarker();

    var item1 = this._findItemForX(this._dragStartCoords[0]),
      item2 = this._findItemForX(this._dragCurrentCoords[0]);

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

  /*
   * Removes the drag rectangle and zoms back to the total extent of the data.
   */
  _resetDrag: function() {
    if (this._dragRectangleG) {
      this._dragRectangleG.remove();
      this._dragRectangleG = null;
      this._dragRectangle = null;
      this._hidePositionMarker();
      this._map.fitBounds(this._fullExtent);
    }
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

  /** Make the map fit the route section between given indexes. */
  _fitSection: function(index1, index2) {
    var start = Math.min(index1, index2),
      end = Math.max(index1, index2);

    var ext = this._calculateFullExtent(this._data.slice(start, end));

    this._map.fitBounds(ext);
  },

  _initToggle: function() {
    /* inspired by L.Control.Layers */
    var container = this._container;

    //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
    container.setAttribute('aria-haspopup', true);

    L.DomEvent
      .disableClickPropagation(container);
    //.disableScrollPropagation(container);

    if (L.Browser.touch) {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    }

    if (this.options.collapsed) {
      this._collapse();

      if (!L.Browser.android) {
        L.DomEvent
          .on(container, 'mouseover', this._expand, this)
          .on(container, 'mouseout', this._collapse, this);
      }
      var link = this._button = L.DomUtil.create('a', "elevation-toggle " + this.options.controlButton.iconCssClass, container);
      link.href = '#';
      link.title = this.options.controlButton.title;

      if (L.Browser.touch) {
        L.DomEvent
          .on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', this._expand, this);
      }

      L.DomEvent.on(link, 'focus', this._expand, this);

      this._map.on('click', this._collapse, this);
      // TODO keyboard accessibility
    }
  },

  _expand: function() {
    this._container.className = this._container.className.replace(' elevation-collapsed', '');
  },

  _collapse: function() {
    L.DomUtil.addClass(this._container, 'elevation-collapsed');
  },

  _width: function() {
    var opts = this.options;
    return opts.width - opts.margins.left - opts.margins.right;
  },

  _height: function() {
    var opts = this.options;
    return opts.height - opts.margins.top - opts.margins.bottom;
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

  _appendYaxis: function(y) {
    y
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
      .style("text-anchor", "end")
      .style("fill", "#000")
      .style("font-weight", "700")
      .text(this.options.imperial ? "ft" : "m");
  },

  _appendXaxis: function(x) {
    x
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
      .style("text-anchor", "end")
      .style("fill", "#000")
      .style("font-weight", "700")
      .text(this.options.imperial ? "mi" : "km");
  },

  _updateAxis: function() {
    this._xaxisgraphicnode.selectAll("g").remove();
    this._xaxisgraphicnode.selectAll("path").remove();
    this._xaxisgraphicnode.selectAll("text").remove();
    this._yaxisgraphicnode.selectAll("g").remove();
    this._yaxisgraphicnode.selectAll("path").remove();
    this._yaxisgraphicnode.selectAll("text").remove();
    this._appendXaxis(this._xaxisgraphicnode);
    this._appendYaxis(this._yaxisgraphicnode);
  },

  _mouseoutHandler: function() {
    //this._hidePositionMarker();
  },

  _resetView: function() {
    this._resetDrag();
    this._forceHidePositionMarker();
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
        container.classList.add("leaflet-control");

        eleDiv.appendChild(container);
      } else {
        this._map.removeControl(this._container);
        this.addTo(this._map);
      }
    }
  },

  _forceHidePositionMarker: function() {
    this._hidePositionMarker(true);
  },

  /*
   * Hides the position-/heigth indication marker drawn onto the map
   */
  _hidePositionMarker: function(force) {
    if (!this.options.autoHideHeightIndicator && !force) {
      return;
    }

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

  /*
   * Handles the moueseover the chart and displays distance and altitude level
   */
  _mousemoveHandler: function(d, i, ctx) {
    if (!this._data || this._data.length === 0) {
      return;
    }
    var coords = d3.mouse(this._background.node());
    var item = this._data[this._findItemForX(coords[0])];

    this._forceHidePositionMarker();
    this._showDiagramIndicator(item, coords[0]);
    this._showPositionMarker(item);

    this._map.fireEvent("elechart_change", {
      data: item
    }, true);

  },

  _showPositionMarker: function(item) {
    var opts = this.options,
      alt = item.altitude,
      dist = item.dist,
      ll = item.latlng,
      numY = opts.hoverNumber.formatter(alt, opts.hoverNumber.decimalsY),
      numX = opts.hoverNumber.formatter(dist, opts.hoverNumber.decimalsX);

    var layerpoint = this._map.latLngToLayerPoint(ll);

    //if we use a height indicator we create one with SVG
    //otherwise we show a marker
    if (opts.useHeightIndicator) {
      if (!this._mouseHeightFocus) {
        var heightG = d3.select(this._map.getContainer()).select(".leaflet-overlay-pane svg")
          .append("g");
        this._mouseHeightFocus = heightG.append('svg:line')
          .attr("class", opts.theme + " height-focus line")
          .attr("x2", 0)
          .attr("y2", 0)
          .attr("x1", 0)
          .attr("y1", 0);

        var pointG = this._pointG = heightG.append("g");
        pointG.append("svg:circle")
          .attr("r", 6)
          .attr("cx", 0)
          .attr("cy", 0)
          .attr("class", opts.theme + " height-focus circle-lower");

        this._mouseHeightFocusLabel = heightG.append("svg:text")
          .attr("class", opts.theme + " height-focus-label")
          .style("pointer-events", "none");

      }

      var normalizedAlt = this._height() / this._maxElevation * alt;
      var normalizedY = layerpoint.y - normalizedAlt;
      this._mouseHeightFocus.attr("x1", layerpoint.x)
        .attr("x2", layerpoint.x)
        .attr("y1", layerpoint.y)
        .attr("y2", normalizedY)
        .style("visibility", "visible");

      this._pointG.attr("transform", "translate(" + layerpoint.x + "," + layerpoint.y + ")")
        .style("visibility", "visible");

      this._mouseHeightFocusLabel.attr("x", layerpoint.x)
        .attr("y", normalizedY)
        .text(numY + (opts.imperial ? " ft" : " m"))
        .style("visibility", "visible");
    } else {
      if (!this._marker) {
        this._marker = new L.Marker(ll).addTo(this._map);
      } else {
        this._marker.setLatLng(ll);
      }
    }
  },

  /*
   * Parsing of GeoJSON data lines and their elevation in z-coordinate
   */
  _addGeoJSONData: function(coords) {
    var opts = this.options;
    if (coords) {
      var data = this._data || [];
      var dist = this._dist || 0;
      var ele = this._maxElevation || 0;
      for (var i = 0; i < coords.length; i++) {
        var s = new L.LatLng(coords[i][1], coords[i][0]);
        var e = new L.LatLng(coords[i ? i - 1 : 0][1], coords[i ? i - 1 : 0][0]);
        var newdist = opts.imperial ? s.distanceTo(e) * this.__mileFactor : s.distanceTo(e);
        dist = dist + Math.round(newdist / 1000 * 100000) / 100000;

        // skip point if it has not elevation
        if (typeof coords[i][2] !== "undefined") {
          ele = ele < coords[i][2] ? coords[i][2] : ele;
          data.push({
            dist: dist,
            altitude: opts.imperial ? coords[i][2] * this.__footFactor : coords[i][2],
            x: coords[i][0],
            y: coords[i][1],
            latlng: s
          });
        }
      }
      this._dist = dist;
      this._data = data;
      ele = opts.imperial ? ele * this.__footFactor : ele;
      this._maxElevation = ele;
    }
  },

  /*
   * Parsing function for GPX data as used by https://github.com/mpetazzoni/leaflet-gpx
   */
  _addGPXdata: function(coords) {
    var opts = this.options;
    if (coords) {
      var data = this._data || [];
      var dist = this._dist || 0;
      var ele = this._maxElevation || 0;
      for (var i = 0; i < coords.length; i++) {
        var s = coords[i];
        var e = coords[i ? i - 1 : 0];
        var newdist = opts.imperial ? s.distanceTo(e) * this.__mileFactor : s.distanceTo(e);
        dist = dist + Math.round(newdist / 1000 * 100000) / 100000;
        // skip point if it has not elevation
        if (typeof s.meta.ele !== "undefined") {
          ele = ele < s.meta.ele ? s.meta.ele : ele;
          data.push({
            dist: dist,
            altitude: opts.imperial ? s.meta.ele * this.__footFactor : s.meta.ele,
            x: s.lng,
            y: s.lat,
            latlng: s
          });
        }
      }
      this._dist = dist;
      this._data = data;
      ele = opts.imperial ? ele * this.__footFactor : ele;
      this._maxElevation = ele;
    }
  },

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
          throw new Error('Invalid GeoJSON object.');
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

  _getLineHexColor: function() {
    var themeName = this.options.theme;
    // TODO: find a better workaround for: this.gpx.setStyle({className: themeName});
    var themeColor = themeName.substring(0, themeName.indexOf("-theme"));
    var hexColor;
    switch (themeColor) {
      case 'lime':
        hexColor = '#566B13';
        break;
      case 'steelblue':
        hexColor = '#4682B4';
        break;
      case 'purple':
        hexColor = '#732C7B';
        break;
      case 'magenta':
        hexColor = '#FF005E';
        break;
      default:
        hexColor = '#566B13';
        break;
    }
    return hexColor;
  },

  /*
   * Add data to the diagram either from GPX or GeoJSON and
   * update the axis domain and data
   */
  addData: function(d, layer) {
    this._addData(d);
    if (this._container) {
      this._applyData();
    }
    if (layer === null && d.on) {
      layer = d;
    }
    if (layer) {
      layer
        .on("mousemove", this._handleLayerMouseOver.bind(this))
        .on("mouseout", this._mouseoutHandler.bind(this));
    }
  },

  addGPXFile: function(url) {
    if (!url) {
      throw "Invalid gpx url";
    }

    this.options.gpxOptions.polyline_options.color = this._getLineHexColor();

    this.gpx = new L.GPX(url, this.options.gpxOptions);

    this.gpx.on('loaded', function(e) {
      this._map.fitBounds(e.target.getBounds());
    });
    this.gpx.once("addline", function(e) {
      this.addData(e.line, this.gpx);
      this._map.fireEvent("eledata_loaded", {
        data: null,
        layer: this.gpx
      }, true);
    }, this);

    this.gpx.addTo(this._map);
  },

  addGeoJSONFile: function(url) {
    if (!url) {
      throw "Invalid gpx url";
    }

    var hexColor = this._getLineHexColor();

    var that = this;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.responseType = 'json';
    xhr.onload = function() {

      if (xhr.status !== 200) return;

      that.geojson = L.geoJson(xhr.response, {
        style: function(feature) {
          return {
            color: that._getLineHexColor()
          };
        },
        onEachFeature: that.addData.bind(that),
      });

      that._map.once('layeradd', function(e) {
        that._map.fitBounds(that.geojson.getBounds());
        that._map.fireEvent("eledata_loaded", {
          data: xhr.response,
          layer: that.geojson
        }, true);
      });

      that.geojson.addTo(that._map);

    };
    xhr.send();
  },

  /*
   * Handles mouseover events of the data layers on the map.
   */
  _handleLayerMouseOver: function(evt) {
    if (!this._data || this._data.length === 0) {
      return;
    }
    var latlng = evt.latlng;
    var item = this._findItemForLatLng(latlng);
    if (item) {
      var x = item.xDiagCoord;

      this._forceHidePositionMarker();
      this._showDiagramIndicator(item, x);
      this._showPositionMarker(item);
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

    var alt = item.altitude,
      dist = item.dist,
      ll = item.latlng,
      numY = opts.hoverNumber.formatter(alt, opts.hoverNumber.decimalsY),
      numX = opts.hoverNumber.formatter(dist, opts.hoverNumber.decimalsX);

    this._focuslabeltext
      // .attr("x", xCoordinate)
      .attr("y", this._y(item.altitude))
      .style("font-weight", "700");

    this._focuslabelX
      .text(numY + (opts.imperial ? " ft" : " m"))
      .attr("x", xCoordinate + 10);
    this._focuslabelY
      .text(numX + (opts.imperial ? " mi" : " km"))
      .attr("x", xCoordinate + 10);

    var bbox = this._focuslabeltext.node().getBBox();
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

  },

  _applyData: function() {
    var xdomain = d3.extent(this._data, function(d) {
      return d.dist;
    });
    var ydomain = d3.extent(this._data, function(d) {
      return d.altitude;
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
   * Reset data
   */
  _clearData: function() {
    this._data = null;
    this._dist = null;
    this._maxElevation = null;
    // if (this.gpx) {
    // 	this.gpx.removeFrom(this._map);
    // }
  },

  /*
   * Reset data and display
   */
  clear: function() {
    this._clearData();

    if (!this._areapath) {
      return;
    }

    // workaround for 'Error: Problem parsing d=""' in Webkit when empty data
    // https://groups.google.com/d/msg/d3-js/7rFxpXKXFhI/HzIO_NPeDuMJ
    //this._areapath.datum(this._data).attr("d", this._area);
    this._areapath.attr("d", "M0 0");

    this._x.domain([0, 1]);
    this._y.domain([0, 1]);
    this._updateAxis();
  },

  hide: function() {
    this._container.style.display = "none";
  },

  show: function() {
    this._container.style.display = "block";
  },

  _addToElevationDiv: function(map) {
    var container = this.onAdd(map);
    container.classList.add("leaflet-control");
    var eleDiv = document.querySelector(this.options.elevationDiv);
    eleDiv.appendChild(container);
  },

  loadChart: function(map) {
    if (this.options.detachedView) {
      this._addToElevationDiv(map);
    } else {
      this.addTo(map);
    }
  },

  loadGPX: function(map, url) {
    this.loadChart(map);
    this.addGPXFile(url);
  },

  loadGeoJSON: function(map, url) {
    this.loadChart(map);
    this.addGeoJSONFile(url);
  }

});

L.control.elevation = function(options) {
  return new L.Control.Elevation(options);
};
