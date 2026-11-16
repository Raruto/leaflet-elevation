@development
Feature: Local development assets
  @unit
  Scenario: CI prepares city mapper from source without requiring its CDN release
    Then integration preparation builds city mapper once and propagates setup failures


  Scenario: Plugin URLs in served pages use the local checkout
    Then the development server rewrites static and plugin loader URLs

  Scenario: City mapper development bundles are explicitly selected
    Then the development server serves only the selected city mapper bundles

  Scenario: Test resources are available without contacting unpkg
    Then unpkg resources are served from the predownloaded cache
