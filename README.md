# leaflet-elevation.js
A Leaflet plugin that allows to add elevation profiles using d3js

<p align="center">
    <a href="https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_hoverable-tracks.html"><img src="https://raruto.github.io/img/leaflet-elevation.png" alt="Leaflet elevation viewer" /></a>
</p>

---

_For a working example see one of the following demos:_
- [loading .gpx file](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation.html)
- [loading .geojson file](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_geojson-data.html)
- [loading string data](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_string-data.html)
- [hoverable chart / hidden map](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_hidden-map.html)
- [hoverable chart / hidden chart](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_hidden-chart.html)
- [hoverable .gpx tracks](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_hoverable-tracks.html)
- [toggable .gpx tracks](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_toggable-tracks.html)
- [toggable .gpx charts](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_toggable-charts.html)
- [custom-theme colors](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_custom-theme.html)
- [close button](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_close-button.html)
- [follow marker location](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_follow-marker.html)

---

<blockquote>
    <p align="center">
        <em>Initially based on the <a href="http://mrmufflon.github.io/Leaflet.Elevation/">work</a> of <strong>Felix “MrMufflon” Bache</strong></em>
    </p>
</blockquote>

---

## How to use

1. **include CSS & JavaScript**
    ```html
    <head>
    ...
    <style> html, body, #map, #elevation-div { height: 100%; width: 100%; padding: 0; margin: 0; } #map { height: 75%; } #elevation-div {	height: 25%; font: 12px/1.5 "Helvetica Neue", Arial, Helvetica, sans-serif; } </style>
    <!-- Leaflet (JS/CSS) -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.3.2/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.3.2/dist/leaflet.js"></script>
    <!-- D3.js -->
    <script src="https://unpkg.com/d3@4.13.0/build/d3.min.js" charset="utf-8"></script>
    <!-- leaflet-gpx -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.4.0/gpx.js"></script>
    <!-- leaflet-elevation -->
    <link rel="stylesheet" href="https://unpkg.com/@raruto/leaflet-elevation@latest/leaflet-elevation.css" />
    <script src="https://unpkg.com/@raruto/leaflet-elevation@latest/leaflet-elevation.js"></script>
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
          data: "https://raruto.github.io/examples/leaflet-elevation/via-emilia.gpx",
          options: {
            position: "topleft",
            theme: "magenta-theme", //default: lime-theme
            useHeightIndicator: true, //if false a marker is drawn at map position
            collapsed: false, //collapsed mode, show chart on click or mouseover
            detachedView: true, //if false the chart is drawn within map container
            elevationDiv: "#elevation-div", // if (detached), the elevation chart container
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
      controlElevation.addTo(map); // attach elevation chart to map

      controlElevation.loadData(opts.elevationControl.data); // url or plain gpx/geojson data

      map.addLayer(baseLayers.OTM);
    </script>
    ```
_Related: [QGIS Integration](https://github.com/faunalia/trackprofile2web)_

---

**Compatibile with:** leaflet@1.3.2, leaflet-gpx@1.4.0, d3js@4.13

---

**Contributors:** [MrMufflon](https://github.com/MrMufflon/Leaflet.Elevation), [HostedDinner](https://github.com/HostedDinner/Leaflet.Elevation), [ADoroszlai](http://ADoroszlai.github.io/joebed/), [Raruto](https://github.com/Raruto/leaflet-elevation)
