Feature: Example track formats, waypoint content and editable data

  Background:
    Given a Chromium browser using the local plugin

  Scenario Outline: Example data: file formats retain coordinates, elevations and map layers
    Given I open the "<example>" data example using "<fixture>"
    Then every profile sample matches the source track coordinates and elevation
    And the track distance and summary agree with its geographic length
    And its map track appears in the layer switcher
    And no browser errors have occurred

    @example-geojson-data
    Examples: GeoJSON
      | example      | fixture      |
      | geojson-data | demo.geojson |

    @example-kml-data
    Examples: KML
      | example  | fixture  |
      | kml-data | demo.kml |

    @example-tcx-data
    Examples: TCX
      | example  | fixture  |
      | tcx-data | demo.tcx |

  Scenario Outline: Example data: waypoints retain custom icons, labels and popup descriptions
    Given I open the "<example>" waypoint example using "<fixture>"
    Then four waypoints appear on the map and as labelled chart checkpoints
    And their icons distinguish the trailhead and summit from other waypoints
    When I open each waypoint popup
    Then each popup contains its source name and description
    And no browser errors have occurred

    @example-geojson-waypoints
    Examples: GeoJSON waypoints
      | example           | fixture           |
      | geojson-waypoints | waypoints.geojson |

    @example-gpx-waypoints
    Examples: GPX waypoints
      | example       | fixture       |
      | gpx-waypoints | waypoints.gpx |

  @example-string-data
  Scenario: Example data: editing, clearing and resetting the inline track
    Given the string-data example has loaded its inline GeoJSON
    When I replace the text with a three-point GeoJSON track and press UPDATE
    Then the edited coordinates, elevations and distance replace the original track
    When I empty the track text and press UPDATE
    Then the editable chart has no data or map track layers
    When I press RESET
    Then the original text, profile and distance are restored
    And no browser errors have occurred
