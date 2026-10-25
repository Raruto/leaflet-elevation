@native-chart
Feature: Native SVG chart without D3

  Background:
    Given a Chromium browser using the local plugin
    And a native chart in a scaled container

  Scenario: Native scales, paths and axes handle boundary values
    Then native scales and bisection handle constant, empty and duplicate values
    And all supported interpolations produce the expected SVG paths
    And native axes and custom callbacks receive SVG elements
    And no browser errors have occurred

  Scenario: Mouse selection can be moved, resized, disabled and reset
    When I select, move and resize a native profile range
    Then the selected samples and rectangle match the pointer positions
    When I disable native brushing and clear the chart
    Then no range or stale zoom remains
    And no browser errors have occurred

  Scenario: Native zoom, ruler and keyboard legend work without D3
    When I zoom and pan the native chart using the mouse
    Then the zoom is bounded and the axes share the visible distance scale
    When I drag the native ruler and toggle the legend using the keyboard
    Then the elevation filter and legend state match the interaction
    And no browser errors have occurred

  Scenario: Touch selection and cancellation release the active gesture
    When I drag a native profile range using touch
    Then a touch range is selected and its tooltip is hidden on release
    When I cancel another touch selection
    Then the active gesture and selection are cleared
    And no browser errors have occurred

  Scenario: Multiline tooltip background fits the aligned text
    Then the tooltip tightly encloses changing labels on both sides of the chart
    And no browser errors have occurred
