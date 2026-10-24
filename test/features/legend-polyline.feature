@issue-272
Feature: Map polyline color follows chart visibility
  Disabling every chart series turns the map track black for both map renderers.

  Background:
    Given a Chromium browser using the local plugin

  Scenario Outline: Disabling all legend entries removes the theme color until a series is restored
    Given a track using the "<renderer>" map renderer and "<profile>" chart renderer
    Then the map track is drawn in the theme color
    When I disable every chart series using the legend
    Then the map track is drawn in black
    When I pan the map with all chart series disabled
    Then the map track is drawn in black
    When I enable altitude using the legend
    Then the map track is drawn in the theme color
    And unrelated map polylines retain their original color
    And no browser errors have occurred

    Examples:
      | renderer | profile |
      | canvas   | SVG     |
      | canvas   | canvas  |
      | SVG      | SVG     |
      | SVG      | canvas  |
