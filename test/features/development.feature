@development
Feature: Local development assets

  Scenario: CDN requests for the plugin use the local checkout
    Then the development server serves local assets for static and dynamic CDN requests
