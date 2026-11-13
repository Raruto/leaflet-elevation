@development
Feature: Local development assets

  Scenario: Plugin URLs in served pages use the local checkout
    Then the development server rewrites static and plugin loader URLs

  Scenario: Test resources are available without contacting unpkg
    Then unpkg resources are served from the predownloaded cache
