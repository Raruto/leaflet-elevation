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
- [gpx waypoint icons](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_gpx-waypoints.html)
- [upload local gpx file](https://raruto.github.io/examples/leaflet-elevation/leaflet-elevation_upload-gpx.html)

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
    <link rel="stylesheet" href="https://unpkg.com/@raruto/leaflet-elevation@latest/leaflet-elevation.css" />
    <script src="https://unpkg.com/@raruto/leaflet-elevation@latest/leaflet-elevation.js"></script>
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

        // Chart distance/elevation units.
        imperial: false,

        // [Lat, Long] vs [Long, Lat] points. (leaflet default: [Lat, Long])
        reverseCoords: false,

        // Summary track info style: "line" || "multiline" || false,
        summary: 'multiline',

      };

      // Instantiate map (leaflet-ui).
      var map = new L.Map('map', { mapTypeId: 'terrain', center: [41.4583, 12.7059], zoom: 5 });

      // Instantiate elevation control.
      var controlElevation = L.control.elevation(elevation_options).addTo(map);

      // Load track from url (allowed data types: "*.geojson", "*.gpx")
      controlElevation.load("https://raruto.github.io/examples/leaflet-elevation/via-emilia.gpx");

    </script>
    ```
_Related: [QGIS Integration](https://github.com/faunalia/trackprofile2web)_

---

**Compatibile with:** leaflet@1.3.2, leaflet-gpx@1.4.0, d3js@4.13

---

**Contributors:** [MrMufflon](https://github.com/MrMufflon/Leaflet.Elevation), [HostedDinner](https://github.com/HostedDinner/Leaflet.Elevation), [ADoroszlai](http://ADoroszlai.github.io/joebed/), [Raruto](https://github.com/Raruto/leaflet-elevation)
