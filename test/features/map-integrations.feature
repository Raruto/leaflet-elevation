Feature: Integrating elevation charts with Leaflet maps

  Background:
    Given a Chromium browser using the local plugin

  Scenario: Map events are safe while the elevation marker module is still loading
    Given the chart is ready but its marker module is still loading
    When the map emits zoom and view reset events
    Then the marker finishes loading and can still be hidden
    And no browser errors have occurred

  @issue-259 @example-almost-over
  Scenario: Replacing tracks preserves zero elevations without duplicating almost-over handlers
    Given the almost-over example has loaded its initial track
    When I reload the almost-over tracks in this order
      | filename        | layers | distance  | time      | maximum | minimum | average           |
      | via-emilia.gpx  | 9      | 264.69343 | 264690738 | 84.9    | 6.6     | 49.10552825552806 |
      | via-aurelia.gpx | 1      | 695.46454 | 695456531 | 638.8   | -3      | 61.47714913485336 |
      | via-emilia.gpx  | 9      | 264.69343 | 264690738 | 84.9    | 6.6     | 49.10552825552806 |
    Then each track has the expected statistics and almost-over layers
    And almost-over stays enabled with exactly one move and one out listener
    And all known sea-level samples in via-aurelia retain zero elevation

  @example-bathymetry
  Scenario: Underwater marker heights are bounded and ordered by elevation
    Given the bathymetry example has loaded its track
    When I display the map marker for every underwater sample
    Then all 178 markers have finite heights within the chart and aligned elevation labels
    And their heights increase monotonically from the chart minimum to maximum

  @example-edge-scale
  Scenario: The edge scale enables its bar, icon and coordinates
    When I open the edge-scale example
    Then the edge scale control is initialized with its bar, icon and coordinates enabled
    When I run the edge-scale example replacement button through all cycles
    Then the edge scale stays rendered and only the final track waypoints remain
    And no browser errors have occurred

  # https://github.com/Raruto/leaflet-elevation/issues/238#issuecomment-1493717835
  # https://github.com/Raruto/leaflet-elevation/issues/238#issuecomment-1493826767
  @issue-238 @example-multiple-maps
  Scenario: Multiple charts do not overwrite shared defaults
    When I open the multiple-maps example
    Then every chart keeps its legend and the shared default margins stay unchanged
    And all three maps show their own track and correctly attached or detached chart
    When I hide the altitude profile in the first map
    Then the other maps keep their altitude profiles and track statistics unchanged

  @example-geojson-group
  Scenario: Moving over an attached chart does not move the map
    Given the GeoJSON group example has an attached chart
    When I move the pointer into the chart overlay
    Then the chart receives the mouse movement but the map does not
    When I select the other GeoJSON track in the layer switcher
    Then the attached profile contains only the selected track and its map layer
