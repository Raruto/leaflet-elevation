/*
 * https://github.com/adoroszlai/joebed/tree/gh-pages
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014- Doroszlai Attila, 2019- Raruto
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

L.Mixin.Selectable = {
  includes: L.Mixin.Events,

  setSelected: function(s) {
    var selected = !!s;
    if (this._selected !== selected) {
      this._selected = selected;
      this.fire('selected');
    }
  },

  isSelected: function() {
    return !!this._selected;
  },
};

L.Mixin.Selection = {
  includes: L.Mixin.Events,

  getSelection: function() {
    return this._selected;
  },

  setSelection: function(item) {
    if (this._selected === item) {
      if (item !== null) {
        item.setSelected(!item.isSelected());
        if (!item.isSelected()) {
          this._selected = null;
        }
      }
    } else {
      if (this._selected) {
        this._selected.setSelected(false);
      }
      this._selected = item;
      if (this._selected) {
        this._selected.setSelected(true);
      }
    }
    this.fire('selection_changed');
  },
};

L.Control.LayersLegend = L.Control.Layers.extend({
  _onInputClick: function() {
    var inputs = this._layerControlInputs,
      input, layer;
    var addedLayers = [],
      removedLayers = [];

    this._handlingClick = true;

    for (var i = inputs.length - 1; i >= 0; i--) {
      input = inputs[i];
      layer = this._getLayer(input.layerId).layer;

      if (input.checked) {
        this._map.fireEvent("legend_selected", {
          layer: layer,
          input: input,
        }, true);

      }
    }

    this._handlingClick = false;

    this._refocusOnMap();

  }
});

L.control.layersLegend = function(baseLayers, overlays, options) {
  return new L.Control.LayersLegend(baseLayers, overlays, options);
};

L.GPX.include(L.Mixin.Selectable);

L.GpxGroup = L.Class.extend({
  options: {
    async: true,
    highlight: {
      color: '#ff0',
      opacity: 1,
    },
    points: [],
    points_options: {
      icon: {
        iconUrl: '../images/elevation-poi.png',
        iconSize: [12, 12],
      }
    },
    flyToBounds: true,
    legend: false,
    legend_options: {
      position: "topright",
      collapsed: false,
    },
    elevation: true,
    elevation_options: {
      theme: 'yellow-theme',
      // width: 500,
      detachedView: true,
      elevationDiv: '#elevation-div',
    },
    distanceMarkers: true,
    distanceMarkers_options: {
      lazy: true
    },
    marker_options: {
      startIconUrl: null,
      endIconUrl: null,
      shadowUrl: null,
    }
  },

  initialize: function(tracks, options) {

    L.Util.setOptions(this, options);

    this._count = 0;
    this._loadedCount = 0;
    this._tracks = tracks;
    this._routes = {};
    this._layers = L.featureGroup();
    this._markers = L.featureGroup();
    this._elevation = L.control.elevation(this.options.elevation_options);
    this._legend = L.control.layersLegend(null, null, this.options.legend_options);

    var icon = L.icon(this.options.points_options.icon);
    this.options.points.forEach(function(poi) {
      var marker = L.marker(poi.latlng, {
        icon: icon
      });
      marker.bindTooltip(poi.name, {
        direction: 'auto'
      });
      marker.addTo(this._markers);
    }, this);

    if (typeof L.DistanceMarkers === "undefined") {
      this.options.distanceMarkers = false;
    }

  },

  getBounds: function() {
    return this._layers.getBounds();
  },

  addTo: function(map) {
    this._layers.addTo(map);
    this._markers.addTo(map);

    this._map = map;

    this.on('selection_changed', this._onSelectionChanged, this);
    this._map.on('legend_selected', this._onLegendSelected, this);
    this._tracks.forEach(this.addTrack, this);

  },

  addTrack: function(track) {
    this._get(track, this._loadRoute.bind(this));
  },

  _loadRoute: function(data) {
    var colors = this._uniqueColors(this._tracks.length);
    var color = colors[this._count++];

    var line_style = {
      color: color,
      opacity: 0.75,
      weight: 5,
      distanceMarkers: this.options.distanceMarkers_options,
    };

    var route = new L.GPX(data, {
      async: this.options.async,
      marker_options: this.options.marker_options,
      polyline_options: line_style
    });

    route.originalStyle = line_style;

    route.on('addline', L.bind(this._onRouteAddLine, this, route));
    route.on('loaded', L.bind(this._onRouteLoaded, this, route));

    route.addTo(this._layers);
    this._routes[route._leaflet_id] = route;
  },

  _onRouteAddLine: function(route, e) {
    var polyline = e.line;

    route.on('selected', L.bind(this._onRouteSelected, this, route, polyline));

    polyline.on('mouseover', L.bind(this._onRouteMouseOver, this, route, polyline));
    polyline.on('mouseout', L.bind(this._onRouteMouseOut, this, route, polyline));
    polyline.on('click', L.bind(this._onRouteClick, this, route, polyline));

    polyline.bindTooltip(route.get_name(), {
      direction: 'auto',
      sticky: true,
    });
  },

  highlight: function(route, polyline) {
    polyline.setStyle(this.options.highlight);
    if (this.options.distanceMarkers) {
      polyline.addDistanceMarkers();
    }
  },

  unhighlight: function(route, polyline) {
    polyline.setStyle(route.originalStyle);
    if (this.options.distanceMarkers) {
      polyline.removeDistanceMarkers();
    }
  },

  _onRouteMouseOver: function(route, polyline) {
    if (!route.isSelected()) {
      this.highlight(route, polyline);
      if (this.options.legend) {
        this.setSelection(route);
        L.DomUtil.get('legend_' + route._leaflet_id).parentNode.previousSibling.click();
      }
    }
    this.fire('route_mouseover', {
      route: route,
      polyline: polyline
    });
  },

  _onRouteMouseOut: function(route, polyline) {
    if (!route.isSelected()) {
      this.unhighlight(route, polyline);
    }
    this.fire('route_mouseout', {
      route: route,
      polyline: polyline
    });
  },

  _onRouteClick: function(route, polyline) {
    this.setSelection(route);
  },

  _onRouteSelected: function(route, polyline) {
    if (!route.isSelected()) {
      this.unhighlight(route, polyline);
    }
  },

  _onRouteLoaded: function(route) {
    if (this.options.legend) {
      this._legend.addBaseLayer(route, '<svg id="legend_' + route._leaflet_id + '" width="25" height="10" version="1.1" xmlns="http://www.w3.org/2000/svg">' + '<line x1="0" x2="50" y1="5" y2="5" stroke="' + route.options.polyline_options.color + '" fill="transparent" stroke-width="5" /></svg>' + ' ' + route.get_name());
    }
    this.fire('route_loaded', {
      route: route,
    });
    if (++this._loadedCount === this._tracks.length) {
      this.fire('loaded');
      if (this.options.flyToBounds) {
        this._map.flyToBounds(this.getBounds(), {
          duration: 0.25,
          easeLinearity: 0.25,
          noMoveStart: true
        });
      }
      if (this.options.legend) {
        this._legend.addTo(this._map);
      }
    }
  },

  _onSelectionChanged: function(e) {
    var elevation = this._elevation;
    var eleDiv = elevation.getContainer();
    var route = this.getSelection();

    elevation.clear();

    if (route && route.isSelected()) {
      if (!eleDiv) {
        elevation.loadChart(this._map);
      }
      route.getLayers().forEach(function(layer) {
        if (layer instanceof L.Polyline) {
          elevation.addData(layer);
          layer.bringToFront();
        }
      });
    } else {
      if (eleDiv) {
        elevation.remove();
      }
    }
  },

  _onLegendSelected: function(e) {
    var layers = this._layers._layers;
    var route = e.layer;
    if (!route.isSelected()) {
      this.setSelection(route);
      for (var i in route._layers) {
        this.highlight(route, route._layers[i]);
      }
      map.flyToBounds(e.layer.getBounds());
    }
    e.input.scrollIntoView({
      behavior: 'smooth'
    });
    for (var j in layers) {
      var selected = layers[j].isSelected();
      var legend = L.DomUtil.get('legend_' + layers[j]._leaflet_id);
      legend.querySelector("line").style.stroke = selected ? this.options.highlight.color : "";
      legend.parentNode.style.fontWeight = selected ? "700" : "";
    }
  },

  _get: function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
        callback(xhr.response);
      }
    };
    xhr.send();
  },

  _uniqueColors: function(count) {
    if (count === 0) return [];
    if (count === 1) return ['#0000ff'];
    var increment = 1 / count;
    var colors = [];
    for (var i = 0; i < count; ++i) {
      var hue = i * increment;
      var rgb = this._hsvToRgb(hue, 1, 0.7);
      var hex = '#' + this._rgbToHex(rgb[0], rgb[1], rgb[2]);
      colors.push(hex);
    }
    return colors;
  },

  _hsvToRgb: function(h, s, v) {
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
    }

    return [r * 255, g * 255, b * 255];
  },

  _rgbToHex: function(r, g, b) {
    return this._byteToHex(r) + this._byteToHex(g) + this._byteToHex(b);
  },

  _byteToHex: function(n) {
    return ((n >> 4) & 0x0F).toString(16) + (n & 0x0F).toString(16);
  },

  removeFrom: function(map) {
    this._layers.removeFrom(map);
  },

});

L.GpxGroup.include(L.Mixin.Events);
L.GpxGroup.include(L.Mixin.Selection);

L.gpxGroup = function(tracks, options) {
  return new L.GpxGroup(tracks, options);
};
