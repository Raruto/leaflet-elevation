Feature: Example chart presentation and specialized profiles
  Background:
    Given a Chromium browser using the local plugin

  @example-chart_labels
  Scenario: Example presentation: waypoint labels are aligned and rotated on the chart
    When I open the presentation example "chart_labels"
    Then the chart shows the eight Via Emilia city labels rotated around their anchors
    And no browser errors have occurred

  @example-custom-theme
  Scenario: Example presentation: custom textures and the external summary are applied
    When I open the presentation example "custom-theme"
    Then the custom chart and map line use the example theme
    And the external summary reports the loaded track statistics
    And no browser errors have occurred

  @example-extended-ui
  Scenario: Example presentation: custom fitness profiles and legend controls work
    When I open the presentation example "extended-ui"
    Then the fitness chart reports heart rate cadence and pace from the timed track
    When I toggle the fitness heart legend off and on
    Then the heart profile is restored without hiding cadence or pace
    And no browser errors have occurred

  @example-i18n-strings
  Scenario: Example presentation: Italian translations appear in summaries and hover details
    When I open the presentation example "i18n-strings"
    Then the summary and legend use the Italian example translations
    When I hover over the presentation chart
    Then the presentation tooltip contains "Altitudine:" and "Distanza:"
    And no browser errors have occurred

  @example-multiple-charts
  Scenario: Example presentation: three independent profiles show their own statistics
    When I open the presentation example "multiple-charts"
    Then all three profiles render their own series and external summaries
    And hovering each profile shows its own measurement on the shared map
    And no browser errors have occurred

  @example-slope-chart
  Scenario: Example presentation: slope values and climbing summaries match the track
    When I open the presentation example "slope-chart"
    Then the slope profile agrees with elevation changes over distance
    And the "slope" profile summary uses "%" units
    When I hover over the presentation chart
    Then the presentation tooltip contains "m:" and "%"
    And no browser errors have occurred

  @example-speed-chart
  Scenario: Example presentation: speed is converted to knots in values and summaries
    When I open the presentation example "speed-chart"
    Then the speed profile converts the timed track to knots
    And the "speed" profile summary uses "knts" units
    When I hover over the presentation chart
    Then the presentation tooltip contains "v:" and "knts"
    And no browser errors have occurred

  @example-temperature-chart
  Scenario: Example presentation: GPX temperatures appear in Celsius with summaries
    When I open the presentation example "temperature-chart"
    Then the temperature profile shows the default parser's integer GPX sensor readings
    And the "temperature" profile summary uses "°C" units
    When I hover over the presentation chart
    Then the presentation tooltip contains "Temp:" and "°C"
    And no browser errors have occurred
