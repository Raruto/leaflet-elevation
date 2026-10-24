@issue-275 @example-upload-gpx
Feature: Uploading GPX tracks with waypoints
  Uploading a replacement track removes old markers, labels and chart checkpoints.

  Background:
    Given a Chromium browser using the local plugin

  Scenario: Repeated waypoint uploads and a track without waypoints
    Given the GPX upload example is ready
    When I upload "waypoints.gpx"
    Then the track has 4 visible labelled waypoint markers and chart checkpoints
    And the uploaded track has a positive distance
    When I upload "waypoints.gpx"
    Then the track has 4 visible labelled waypoint markers and chart checkpoints
    And the uploaded track has a positive distance
    When I upload "time.gpx"
    Then the track has 0 visible labelled waypoint markers and chart checkpoints
    And the uploaded track has a positive distance
    And no browser errors or warnings have occurred during uploads
