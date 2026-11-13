@smoke
Feature: Example smoke tests
  Scenario: The examples list is complete
    Then all HTML examples are listed

  Scenario: Development URLs are rewritten only in served HTML
    Then development pages rewrite CDN URLs without changing files

  Scenario Outline: An example loads without browser errors
    Then the example "<example>" loads without browser errors

    Examples:
      | example |
      | leaflet-elevation.html |
      | leaflet-elevation_almost-over.html |
      | leaflet-elevation_bathymetry.html |
      | leaflet-elevation_chart_labels.html |
      | leaflet-elevation_clear-button.html |
      | leaflet-elevation_close-button.html |
      | leaflet-elevation_custom-summary.html |
      | leaflet-elevation_custom-theme.html |
      | leaflet-elevation_dynamic-runner.html |
      | leaflet-elevation_edge-scale.html |
      | leaflet-elevation_extended-ui.html |
      | leaflet-elevation_follow-marker.html |
      | leaflet-elevation_geojson-data.html |
      | leaflet-elevation_geojson-group.html |
      | leaflet-elevation_geojson-waypoints.html |
      | leaflet-elevation_gpx-waypoints.html |
      | leaflet-elevation_hidden-chart.html |
      | leaflet-elevation_hidden-map.html |
      | leaflet-elevation_hoverable-tracks.html |
      | leaflet-elevation_i18n-strings.html |
      | leaflet-elevation_kml-data.html |
      | leaflet-elevation_linear-gradient.html |
      | leaflet-elevation_live-tracking.html |
      | leaflet-elevation_multiple-charts.html |
      | leaflet-elevation_multiple-maps.html |
      | leaflet-elevation_slope-chart.html |
      | leaflet-elevation_speed-chart.html |
      | leaflet-elevation_string-data.html |
      | leaflet-elevation_tcx-data.html |
      | leaflet-elevation_temperature-chart.html |
      | leaflet-elevation_toggable-charts.html |
      | leaflet-elevation_toggable-tracks.html |
      | leaflet-elevation_upload-gpx.html |
