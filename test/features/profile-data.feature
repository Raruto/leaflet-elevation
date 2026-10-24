Feature: Rendering elevation data and restoring chart controls

  Background:
    Given a Chromium browser using the local plugin

  @example-linear-gradient
  Scenario: The unmodified gradient example maps track altitude limits to green and red
    Given the gradient example uses its original track-statistic limits
    When I load the gradient track
    Then every gradient stop is positioned at its normalized chart x coordinate
    And the lowest and highest elevations use opposite ends of the gradient palette
    And the altitude path uses the generated SVG gradient
    And no browser errors have occurred

  @issue-306 @example-linear-gradient
  Scenario: Gradient stops follow horizontal data coordinates and numeric color limits
    Given the gradient example uses numeric limits 100000 and 200000
    When I load the gradient track
    Then every gradient stop is positioned at its normalized chart x coordinate
    And all gradient stops use the lower-limit color "rgb(1,136,0)"

  @issue-265
  Scenario: Missing and constant elevations do not produce invalid hotline colors
    Given a hotline track with missing, zero and valid elevations
    When I draw mixed, unknown and constant elevation segments and pan the map
    Then only finite segment endpoints are passed to the color scale
    And constant elevation colors contain only finite components
    And no browser errors have occurred

  @issue-290
  Scenario: Re-adding a detached elevation control restores its ruler
    Given a detached elevation control with a visible ruler
    When I remove and re-add the control
    Then the ruler is restored in the new control container
