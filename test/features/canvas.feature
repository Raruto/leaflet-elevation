Feature: Canvas profile rendering across browsers

  @issue-232
  Scenario Outline: Low-level canvas alignment, tooltip overlay, resize, and clear
    Given I open the low-level canvas page in "<browser>"
    And I create a canvas chart with a mask and tooltip overlay
    When I draw the red canvas at left margin 40
    Then the canvas pixels show the aligned profile and tooltip overlay
    When I resize and draw the red canvas at left margin 70
    Then the canvas pixels show the aligned profile and tooltip overlay
    When I clear and draw the canvas at left margin 70
    Then the canvas pixels show the cleared profile and tooltip overlay

    Examples: Chromium and WebKit platforms
      | browser        |
      | macOS Chromium |
      | macOS WebKit   |
      | iOS Safari     |
      | iOS Chrome     |

  @issue-232 @issue-123
  Scenario Outline: Chart integration preserves profile pixels through resize and visibility changes
    Given I open a transformed chart host in "<browser>" at DPR <dpr>
    When I render a profile with "<rendering mode>" rendering
    And I resize the profile to width 320 and left margin 40
    Then the profile pixels show the aligned altitude area and tooltip
    When I hide the altitude area
    Then the profile pixels show no altitude area and preserve the tooltip
    When I show the altitude area
    Then the profile pixels show the restored altitude area and tooltip
    When I clear the profile
    Then the profile pixels show a cleared chart
    When I resize the profile to width 280 and left margin 70
    Then the profile pixels show the aligned altitude area and tooltip
    When I hide the altitude area
    Then the profile pixels show no altitude area and preserve the tooltip
    When I show the altitude area
    Then the profile pixels show the restored altitude area and tooltip
    When I clear the profile
    Then the profile pixels show a cleared chart
    And the browser reports no page errors

    @issue-123
    Examples: iOS browsers and iPad desktop mode
      | browser           | dpr | rendering mode |
      | iOS Safari        | 3   | canvas         |
      | iOS Safari        | 3   | SVG            |
      | iOS Firefox       | 3   | canvas         |
      | iOS Firefox       | 3   | SVG            |
      | iOS Chrome        | 3   | canvas         |
      | iOS Chrome        | 3   | SVG            |
      | iPad desktop mode | 3   | canvas         |
      | iPad desktop mode | 3   | SVG            |

    @issue-232
    Examples: macOS desktop browsers
      | browser      | dpr | rendering mode |
      | macOS Chrome | 2   | canvas         |
      | macOS Chrome | 2   | SVG            |
      | macOS Safari | 2   | canvas         |
      | macOS Safari | 2   | SVG            |
