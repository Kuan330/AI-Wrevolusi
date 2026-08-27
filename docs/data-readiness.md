# Data Readiness

This document separates four different readiness states:

1. **Public source available**: a data source exists and can be accessed.
2. **Internal dataset prepared**: our cleaned working dataset is prepared.
3. **Mapping validated**: required mappings are reviewed and approved.
4. **Feature ready for development**: data quality is good enough to build product features.

## Current pilot data readiness

| Data area                                  | Public source available | Internal dataset prepared | Mapping validated | Feature ready for development | Notes                                                      |
| ------------------------------------------ | ----------------------- | ------------------------- | ----------------- | ----------------------------- | ---------------------------------------------------------- |
| Christine primary MASCO occupation         | Yes                     | In progress               | In progress       | No                            | TODO: add validated MASCO code in fixtures.                |
| Two related occupations                    | Yes                     | In progress               | In progress       | No                            | TODO: confirm occupation titles and validated MASCO codes. |
| Task data for pilot occupations            | Yes                     | Not started               | Not started       | No                            | TODO: do not add unvalidated task data to the product yet. |
| MASCO to ISCO mapping                      | Yes                     | In progress               | Not started       | No                            | TODO: add mapping only after validation.                   |
| AI-exposure scores                         | Unknown                 | Not started               | Not started       | No                            | TODO: do not invent or estimate scores.                    |
| E2 NLP task matching/classification inputs | Partial                 | Not started               | Not started       | No                            | Depends on validated occupation and task dataset.          |
| E3 capability recognition inputs           | Partial                 | Not started               | Not started       | No                            | Depends on E2 task outputs and validated text sources.     |
| E5 pathway ranking inputs                  | Partial                 | Not started               | Not started       | No                            | Depends on E1-E4 outputs and pathway reference data.       |
| E6 personalised priority inputs            | Partial                 | Not started               | Not started       | No                            | Depends on E2, E3 and E4 outputs, E5 optional.             |
