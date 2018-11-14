# leaflet-elevation.js
A Leaflet plugin that allows to add elevation profiles using d3js

_For a working example see [demo](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation.html) and [demo](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_hidden-map.html)_

---

> _Initally based on the [work](http://mrmufflon.github.io/Leaflet.Elevation/) of **Felix “MrMufflon” Bache**_

## How to use

1. **include CSS & JavaScript**
    ```html
    <head>
    ...
    <style> html, body, #map, #elevation-div { height: 100%; width: 100%; padding: 0; margin: 0; } #map { height: 75%; } #elevation-div {	height: 25%; font: 12px/1.5 "Helvetica Neue", Arial, Helvetica, sans-serif; } </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/4.13.0/d3.js" charset="utf-8"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.2/leaflet.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.2/leaflet-src.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.4.0/gpx.js"></script>
    <link rel="stylesheet" href="https://raruto.github.io/cdn/leaflet-elevation/0.0.5/leaflet-elevation.css" />
    <script src="https://raruto.github.io/cdn/leaflet-elevation/0.0.5/leaflet-elevation.js"></script>
    ...
    </head>
    ```
2. **choose the div containers used for the slippy map**
    ```html
    <body>
    ...
    <div id="map"></div>
    <div id="elevation-div"></div>
    ...
    </body>
    ```
3. **create your first simple “leaflet-elevation” slippy map**
    ```html
    <script>
      var opts = {
        map: {
          center: [41.4583, 12.7059],
          zoom: 5,
          markerZoomAnimation: false,
          zoomControl: false,
        },
        zoomControl: {
          position: 'topleft',
        },
        otmLayer: {
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          options: {
            attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
            /*subdomains:"1234"*/
          },
        },
        elevationControl: {
          url: "https://raruto.github.io/examples/leaflet-elevation/via-emilia.gpx",
          options: {
            position: "topleft",
            theme: "magenta-theme", //default: lime-theme
            useHeightIndicator: true, //if false a marker is drawn at map position
            interpolation: d3.curveLinear, //see https://github.com/d3/d3/wiki/
            collapsed: false, //collapsed mode, show chart on click or mouseover
            elevationDiv: "#elevation-div",
            detachedView: true,
            responsiveView: true,
          },
        },
        layersControl: {
          options: {
            collapsed: false,
          },
        },
      };

      var map = new L.Map('map', opts.map);

      var baseLayers = {};
      baseLayers.OTM = new L.TileLayer(opts.otmLayer.url, opts.otmLayer.options);

      var controlZoom = new L.Control.Zoom(opts.zoomControl);
      var controlElevation = L.control.elevation(opts.elevationControl.options);
      var controlLayer = L.control.layers(baseLayers, null, opts.layersControl.options);

      controlZoom.addTo(map);
      controlLayer.addTo(map);
      controlElevation.loadGPX(map, opts.elevationControl.url);

      map.addLayer(baseLayers.OTM);
    </script>
    ```

---

**Compatibile with:** leaflet@1.3.2, leaflet-gpx@1.4.0, d3js@4.13

---

**Contributors:** [MrMufflon](https://github.com/MrMufflon/Leaflet.Elevation), [HostedDinner](https://github.com/HostedDinner/Leaflet.Elevation), [Raruto](https://github.com/Raruto/leaflet-elevation)
