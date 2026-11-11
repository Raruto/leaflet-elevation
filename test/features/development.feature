@development
Feature: Local development assets

  Scenario: Plugin URLs in served pages use the local checkout
    Then the development server rewrites static and plugin loader URLs
