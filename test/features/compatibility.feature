@compatibility
Feature: Native Leaflet 1.9 and 2 beta compatibility without leaflet-ui
  Scenario Outline: Public bundles render profiles and optional map integrations
    Given the native Leaflet compatibility fixture uses "<bundle>"
    Then native profiles, markers, gradients, distance markers and scales work
    And native grouped-track legends and measurement controls work
    And native profile clearing and reloading preserves initialization hooks

    Examples:
      | bundle   |
      | readable |
      | minified |

  Scenario: Edge scale ticks work with a rotated native map
    Given the native Leaflet compatibility fixture uses "readable"
    When I create a rotated map for the native compatibility fixture
    Then the edge scale draws correctly through rotation, pan, zoom and resize

  Scenario: Chart events are fired on the elevation control
    Given the native Leaflet compatibility fixture uses "readable"
    Then chart events are emitted on the elevation control

  Scenario: Chart event listeners follow the control lifecycle
    Given the native Leaflet compatibility fixture uses "readable"
    Then chart events remain isolated when a control is removed and re-added
