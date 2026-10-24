Feature: Loading and replacing tracks
  Loaded events expose complete track data, and replacing a track removes its old points.

  Background:
    Given a Chromium browser using the local plugin

  Scenario: A loaded GPX exposes its name, layer and distance
    Given the "default" example is waiting to load "via-emilia.gpx"
    When the track response is released
    Then the loaded track is named "via-emilia.gpx" and has a layer and numeric distance

  # https://github.com/Raruto/leaflet-elevation/issues/283
  @issue-283
  Scenario: Custom summaries receive complete data after point processing
    Given the "custom-summary" example is waiting to load "demo.geojson"
    When the track response is released
    Then the loaded track is named "demo.geojson" and has a layer and numeric distance
    And data is added before the loaded event
    And the start and end markers match the processed track endpoints
    And the custom summary displays the loaded distance in kilometres

  Scenario: Replacing and clearing tracks does not leave stale waypoints
    Given the clear-button example has loaded its initial track
    When I replace the track in this order
      | index | name              | points |
      | 0     | demo.geojson      | 0      |
      | 1     | waypoints.geojson | 4      |
      | 0     | demo.geojson      | 0      |
      | 1     | waypoints.geojson | 4      |
    Then each replacement clears once before loading its track and expected points
    When I clear the track without loading another
    Then no track layers, statistics or chart points remain
    And only a clear event is emitted
