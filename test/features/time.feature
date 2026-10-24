Feature: Track durations and the time axis

  Background:
    Given a Chromium browser using the local plugin

  @issue-300
  Scenario: Imperial distance units do not change estimated travel time
    Given imperial units and a short GPX without timestamps
    When I load the track with estimated time
    Then the estimated duration uses geographic kilometres within 2 milliseconds
    And the displayed track distance is less than one mile

  @issue-170
  Scenario: Time ticks follow a variable-speed four-day track including a stationary pause
    Given a four-day GPX with variable speed and a 24-hour stationary pause
    When I load the track with the time axis and a numeric duration formatter
    When I set the time-axis zoom to 1
    Then the time ticks interpolate recorded durations at their horizontal positions
    When I set the time-axis zoom to 2
    Then the time ticks interpolate recorded durations at their horizontal positions
    When I set the time-axis zoom to 1
    Then the time ticks interpolate recorded durations at their horizontal positions
    And the time labels at recorded distances use the duration after the pause
    When I clear the time-axis track
    Then no browser errors have occurred
