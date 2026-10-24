Feature: Interacting with the example charts and tracks

  Background:
    Given a Chromium browser using the local plugin

  @example-close-button
  Scenario: Example interaction: close-button opens, closes and reopens its chart
    Given the interactive "close-button" example is ready
    When I open, close and reopen the attached elevation chart
    Then its track and chart data are preserved
    And no browser errors have occurred

  @example-dynamic-runner
  Scenario: Example interaction: dynamic-runner advances along the map and profile
    Given the interactive "dynamic-runner" example is ready
    Then the animated runner advances on both the chart and map
    When I resize the runner chart
    Then the five distance checkpoints are displayed
    And no browser errors have occurred

  @example-follow-marker
  Scenario: Example interaction: a delayed local chart keeps the map and followed marker aligned
    Given the chart module loads only after the map track is visible
    And the interactive "follow-marker" example is ready
    Then the dynamically loaded plugin matches the local build
    When I hover over two distant positions on the elevation profile
    Then the map follows both positions at zoom 15
    And no browser errors have occurred

  @example-follow-marker
  Scenario: Example interaction: follow-marker follows two chart positions at street zoom
    Given the interactive "follow-marker" example is ready
    When I hover over two distant positions on the elevation profile
    Then the map follows both positions at zoom 15
    And no browser errors have occurred

  @example-hidden-chart
  Scenario: Example interaction: hidden-chart expands on hover and collapses on leaving
    Given the interactive "hidden-chart" example is ready
    When I hover over and then leave the chart icon
    Then the chart is collapsed again with its track preserved
    And no browser errors have occurred

  @example-hidden-map
  Scenario: Example interaction: hidden-map reveals, follows continued hovering and hides on leaving
    Given the interactive "hidden-map" example is ready
    When I hover over the hidden-map profile
    Then the map becomes visible
    When I continue hovering over another hidden-map profile position
    Then the map centers on the hovered sample
    When I leave the hidden-map profile
    Then the map is hidden again
    And no browser errors have occurred

  @example-hoverable-tracks
  Scenario: Example interaction: hoverable-tracks selects the hovered route and its legend
    Given the interactive "hoverable-tracks" example is ready
    When I hover over an unselected group track
    Then its profile replaces the placeholder and its legend is selected
    When I select a different route in the group legend
    Then the profile and highlight switch to that route
    And no browser errors have occurred

  @example-toggable-charts
  Scenario: Example interaction: toggable-charts selects and deselects a track by clicking
    Given the interactive "toggable-charts" example is ready
    When I click an unselected group track
    Then its elevation profile is shown
    When I click that group track again
    Then its elevation profile is removed and its original color restored
    And no browser errors have occurred

  @example-toggable-tracks
  Scenario: Example interaction: toggable-tracks switches map tracks and elevation profiles
    Given the interactive "toggable-tracks" example is ready
    When I select the second track radio button
    Then only the second track is mapped and its profile replaces the first
    When I select the first track radio button
    Then the original track and elevation profile are restored
    And no browser errors have occurred
