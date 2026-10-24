Feature: Live tracking example

  Background:
    Given a Chromium browser using the local plugin

  @example-live-tracking
  Scenario: Live tracking appends chart points without creating extra track layers
    Given the live-tracking example is ready
    Then all GPS locations are shown on one map layer and in the elevation chart
    And no browser errors have occurred
