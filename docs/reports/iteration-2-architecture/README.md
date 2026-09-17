# AI-Wrevolusi Iteration 2 architecture report

Code baseline: `aa4f8fb` on `kuan/design-prototype`, 17 September 2026.

## Final files

- [Editable Word report](AI-Wrevolusi-Iteration-2-System-Architecture-Report.docx)
- [PDF report](AI-Wrevolusi-Iteration-2-System-Architecture-Report.pdf)
- [Report text](AI-Wrevolusi-Iteration-2-System-Architecture-Report.md)
- [System architecture PNG](figures/System-Architecture.png)
- [Complete ERD PNG](figures/ERD.PNG)
- [ERD overview](figures/ERD-Overview.png)
- [Full data dictionary](Data-Dictionary.md)

The 16-page report compares the original Iteration 1 design, verified earlier
implementation snapshots and the current architecture. It explains the changes,
the reasons for them, the alternatives considered and the remaining verification
work. The supplied ParkiCare and TransitReach documents are presentation
references rather than evidence about AI-Wrevolusi.

The complete ERD covers 15 ORM tables, 3 current SQL reference tables and a
separate panel of 8 legacy SQL business tables. Its entity boxes show selected
fields. The data dictionary and source JSON contain the full column inventory.
Solid lines are declared foreign keys. Dotted lines are logical associations.
The diagram does not claim that every model is used by every current page or
that the deployed database has been inspected.

## Editable sources and rebuilding

`source/report_content.py` contains the report text. `source/build_report.py`
builds the DOCX and Markdown copies with Python, python-docx and Pillow.

```bash
python3 source/build_report.py
```

Render the DOCX with an existing document renderer to export the PDF, then inspect
all pages after edits. The delivered PDF was rendered from the delivered DOCX.

The diagram SVG and standalone HTML files in `figures/` can also be edited.
See [figure sources](source/FIGURES.md) for the deterministic figure builder,
rendering instructions and notation. No downloaded fonts are required.

## Validation

- All 16 report pages were visually inspected after rendering.
- The document accessibility audit found no high, medium or low issues.
- Visible DOCX and PDF text contains no semicolons.
- All 26 distinct table names and 25 declared foreign key relationships are
  represented across the detailed ERD panels.
- The report distinguishes code checks from unverified database and deployment
  behavior. Application test evidence is recorded in
  [architecture validation](../../architecture-validation.md).
