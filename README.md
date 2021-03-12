# leaflet-elevation.js

[![NPM version](https://img.shields.io/npm/v/@raruto/leaflet-elevation.svg?color=red)](https://www.npmjs.com/package/@raruto/leaflet-elevation)
[![License](https://img.shields.io/badge/license-GPL%203-blue.svg?style=flat)](LICENSE)

A Leaflet plugin that allows to add elevation profiles using d3js

<p align="center">
    <a href="https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_hoverable-tracks.html"><img src="https://raruto.github.io/img/leaflet-elevation.png" alt="Leaflet elevation viewer" /></a>
</p>

---

_For a working example see one of the following demos:_

- [loading .gpx file](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation.html)
- [loading .geojson file](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_geojson-data.html)
- [loading .kml file](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_kml-data.html)
- [loading .tcx file](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_tcx-data.html)
- [loading strings](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_string-data.html)
- [loading geojson group](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_geojson-group.html)
- [loading local .gpx file](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_upload-gpx.html)

<br/>

- [custom colors](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_custom-theme.html)
- [custom summary](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_custom-summary.html)
- [close button](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_close-button.html)
- [slope chart](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_slope-chart.html)
- [speed chart](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_speed-chart.html)
- [i18n strings](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_i18n-strings.html)

<br/>

- [hoverable chart / hidden map](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_hidden-map.html)
- [hoverable chart / hidden chart](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_hidden-chart.html)
- [hoverable tracks](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_hoverable-tracks.html)
- [toggable tracks](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_toggable-tracks.html)
- [toggable charts](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_toggable-charts.html)

<br/>

- [waypoint icons / gpx](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_gpx-waypoints.html)
- [waypoint icons / geojson](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_geojson-waypoints.html)

<br/>

- [almost over](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_almost-over.html)
- [follow marker](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_follow-marker.html)
- [dynamic runner](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_dynamic-runner.html)
- [extended ui](https://raruto.github.io/leaflet-elevation/examples/leaflet-elevation_extended-ui.html)

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

    <!-- leaflet-ui -->
    <script src="https://unpkg.com/leaflet@1.3.2/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet-ui@0.2.0/dist/leaflet-ui.js"></script>

    <!-- leaflet-elevation -->
    <link rel="stylesheet" href="https://unpkg.com/@raruto/leaflet-elevation/dist/leaflet-elevation.css" />
    <script src="https://unpkg.com/@raruto/leaflet-elevation/dist/leaflet-elevation.js"></script>
    ...
    </head>
    ```
2. **choose the div container used for the slippy map**
    ```html
    <body>
    ...
    <div id="map"></div>
    ...
    </body>
    ```
3. **create your first simple “leaflet-elevation” slippy map**
    ```html
    <script>
      // Full list options at "leaflet-elevation.js"
      var elevation_options = {

        // Default chart colors: theme lime-theme, magenta-theme, ...
        theme: "lightblue-theme",

        // Chart container outside/inside map container
        detached: true,

        // if (detached), the elevation chart container
        elevationDiv: "#elevation-div",

        // if (!detached) autohide chart profile on chart mouseleave
        autohide: false,

        // if (!detached) initial state of chart profile control
        collapsed: false,

        // if (!detached) control position on one of map corners
        position: "topright",

        // Autoupdate map center on chart mouseover.
        followMarker: true,

        // Autoupdate map bounds on chart update.
        autofitBounds: true,

        // Chart distance/elevation units.
        imperial: false,

        // [Lat, Long] vs [Long, Lat] points. (leaflet default: [Lat, Long])
        reverseCoords: false,

        // Acceleration chart profile: true || "summary" || "disabled" || false
        acceleration: false,

        // Slope chart profile: true || "summary" || "disabled" || false
        slope: false,

        // Speed chart profile: true || "summary" || "disabled" || false
        speed: false,

        // Display time info: true || "summary" || false
        time: false,

        // Display distance info: true || "summary"
        distance: true,

        // Display altitude info: true || "summary"
        altitude: true,

        // Summary track info style: "line" || "multiline" || false
        summary: 'multiline',

        // Toggle chart ruler filter.
        ruler: true,

        // Toggle chart legend filter.
        legend: true,

        // Toggle "leaflet-almostover" integration
        almostOver: true,

        // Toggle "leaflet-distance-markers" integration
        distanceMarkers: false,

        // Render chart profiles as Canvas or SVG Paths
        preferCanvas: true

      };

      // Instantiate map (leaflet-ui).
      var map = new L.Map('map', { mapTypeId: 'terrain', center: [41.4583, 12.7059], zoom: 5 });

      // Instantiate elevation control.
      var controlElevation = L.control.elevation(elevation_options).addTo(map);

      // Load track from url (allowed data types: "*.geojson", "*.gpx", "*.tcx")
      controlElevation.load("https://raruto.github.io/leaflet-elevation/examples/via-emilia.gpx");

    </script>
    ```
_Related: [Leaflet-UI presets](https://github.com/raruto/leaflet-ui), [QGIS Integration](https://github.com/faunalia/trackprofile2web)_

---

**Compatibile with:**
[![Leaflet 1.x compatible!](https://img.shields.io/badge/Leaflet-1.6.0-1EB300.svg?style=flat)](http://leafletjs.com/reference.html)
[![d3.js v6 compatibile!](https://img.shields.io/badge/d3.js-6.5-1EB300.svg?style=flat)](https://www.npmjs.com/package/d3)
[![@tmcw/togeojson v4.3.0 compatibile!](https://img.shields.io/badge/@tmcw/togeojson-4.3-1EB300.svg?style=flat)](https://www.npmjs.com/package/@tmcw/togeojson)


---

**Contributors:** [MrMufflon](https://github.com/MrMufflon/Leaflet.Elevation), [HostedDinner](https://github.com/HostedDinner/Leaflet.Elevation), [ADoroszlai](http://ADoroszlai.github.io/joebed/), [Raruto](https://github.com/Raruto/leaflet-elevation)
