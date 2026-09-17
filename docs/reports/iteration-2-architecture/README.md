# AI-Wrevolusi Iteration 2 architecture report

Code baseline: `aa4f8fb`, 17 September 2026.

## Report files

- [Word report](AI-Wrevolusi-Iteration-2-System-Architecture-Report.docx) for editing and submission
- [PDF report](AI-Wrevolusi-Iteration-2-System-Architecture-Report.pdf) for reading and sharing
- [Report text](AI-Wrevolusi-Iteration-2-System-Architecture-Report.md) for reading changes on GitHub
- [Data dictionary](Data-Dictionary.md) with the full column inventory

## Diagrams

- [System architecture PNG](figures/System-Architecture.png)
- [Full ERD PNG](figures/ERD.PNG)

The 16-page report compares the original Iteration 1 design, earlier code
snapshots and the current architecture. It explains the changes, reasons,
trade-offs and remaining verification work. The supplied ParkiCare and
TransitReach documents were presentation references, not evidence about
AI-Wrevolusi.

The ERD covers 15 ORM tables, 3 current SQL reference tables and 8 separately
labelled legacy SQL business tables. Boxes show selected fields. The data
dictionary has the full column inventory and source paths relative to the
repository root. Solid lines show declared foreign keys. Dotted lines show
logical associations.

The detailed ERD panels remain embedded in the Word and PDF appendices. The
Markdown report links to those PDF pages. Separate panel images, HTML/SVG
copies, generation scripts and working evidence files are not part of this
tracked package. Local working copies are preserved under the ignored
`.local/architecture-report/` folder.

The report describes code and configuration rather than a verified live
database or deployment. See the existing
[architecture validation note](../../architecture-validation.md) and
[database baseline proposal](../../database-baseline-proposal.md) for checks
and remaining work.
