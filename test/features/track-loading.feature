Feature: Loading and replacing tracks
  Loaded events expose complete track data, and replacing a track removes its old points.

  Background:
    Given a Chromium browser using the local plugin

  @issue-280 @issue-299
  Scenario: Preloaded dependencies work with the built-in lazy loader disabled
    Given all elevation dependencies are bundled and the lazy loader is disabled
    When I load a GPX without requesting any more JavaScript
    Then the statically loaded chart shows its profile, summary and map marker
    And no browser errors have occurred

  @example-default
  Scenario: A loaded GPX exposes its name, layer and distance
    Given the "default" example is waiting to load "via-emilia.gpx"
    When the track response is released
    Then the loaded track is named "via-emilia.gpx" and has a layer and numeric distance

  @issue-283 @example-custom-summary
  Scenario: Custom summaries receive complete data after point processing
    Given the "custom-summary" example is waiting to load "demo.geojson"
    When the track response is released
    Then the loaded track is named "demo.geojson" and has a layer and numeric distance
    And data is added before the loaded event
    And the start and end markers match the processed track endpoints
    And the custom summary displays the loaded distance in kilometres
    And the custom summary displays elevation limits, ascent and descent from track statistics

  @example-clear-button
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
