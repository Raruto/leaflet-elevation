@unit
Feature: Keeping example coverage complete
  Every demonstration page has an explicitly tagged behavioral scenario.

  Scenario: Every HTML example is mapped to a Cucumber scenario
    Given the HTML demonstration pages in the examples folder
    Then each demonstration has at least one scenario tagged with its example name
