@unit
Feature: Incremental track statistics
  Statistics are updated one sample at a time without retaining previous samples.

  Scenario: Average includes each sample and propagates invalid values
    Given an incremental "average" with no previous samples
    When I add the samples "100, 100, 200, 200, NaN" in order
    Then the result after each sample rounded to two decimals is
      | sample | expected |
      | 100    | 100      |
      | 100    | 100      |
      | 200    | 133.33   |
      | 200    | 150      |
      | NaN    | NaN      |

  Scenario: Minimum ignores invalid values and includes zero and negative values
    Given an incremental "minimum" with no previous samples
    When I add the samples "100, NaN, 0, -200, 200" in order
    Then the result after each sample rounded to two decimals is
      | sample | expected |
      | 100    | 100      |
      | NaN    | 100      |
      | 0      | 0        |
      | -200   | -200     |
      | 200    | -200     |

  Scenario: Maximum ignores invalid values and includes zero and negative values
    Given an incremental "maximum" with no previous samples
    When I add the samples "100, NaN, 0, -200, 200" in order
    Then the result after each sample rounded to two decimals is
      | sample | expected |
      | 100    | 100      |
      | NaN    | 100      |
      | 0      | 100      |
      | -200   | 100      |
      | 200    | 200      |

  Scenario: Sum includes fractional, zero and negative values and propagates invalid values
    Given an incremental "sum" with no previous samples
    When I add the samples "10.25, 0, -0.25, -10, NaN" in order
    Then the result after each sample rounded to two decimals is
      | sample | expected |
      | 10.25  | 10.25    |
      | 0      | 10.25    |
      | -0.25  | 10       |
      | -10    | 0        |
      | NaN    | NaN      |
