from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'pdf' / 'accountant-to-ict-sales-demo-resume.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ResumeName', fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=colors.HexColor('#17364A'), spaceAfter=3))
styles.add(ParagraphStyle(name='ResumeRole', fontName='Helvetica-Bold', fontSize=11, leading=15, spaceAfter=5))
styles.add(ParagraphStyle(name='ResumeContact', fontSize=9, leading=12, textColor=colors.HexColor('#4B5563'), spaceAfter=10))
styles.add(ParagraphStyle(name='ResumeHeading', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=colors.HexColor('#17364A'), spaceBefore=11, spaceAfter=5))
styles.add(ParagraphStyle(name='ResumeBody', fontName='Helvetica', fontSize=9.3, leading=13, spaceAfter=4))
styles.add(ParagraphStyle(name='ResumeJob', fontName='Helvetica-Bold', fontSize=9.5, leading=13, spaceAfter=3))
styles.add(ParagraphStyle(name='ResumeBullet', fontName='Helvetica', fontSize=9.3, leading=13, leftIndent=10, firstLineIndent=-8, spaceAfter=4))
story = []
def p(text, style='ResumeBody'):
    story.append(Paragraph(text, styles[style]))
def heading(text): p(text, 'ResumeHeading')
def bullet(text): p('- ' + text, 'ResumeBullet')

p('ALEX MORGAN', 'ResumeName')
p('ACCOUNTANT', 'ResumeRole')
p('Melbourne, VIC | alex.morgan@example.com | Contact details available on request', 'ResumeContact')
heading('PROFESSIONAL SUMMARY')
p('Accountant with five years of experience in financial reporting, reconciliations, budgeting and small-business advisory. Confident explaining financial results to non-finance stakeholders and helping clients use cloud accounting software. Brings commercial analysis, client relationship management and software training experience, with an interest in moving into a client-facing ICT sales role.')
heading('CORE SKILLS')
p('<b>Accounting:</b> Financial statements, month-end close, general ledger, bank reconciliations, accounts payable and receivable, cash-flow forecasting, budgeting and variance analysis.')
p('<b>Client and commercial:</b> Client needs discovery, stakeholder presentations, relationship management, cost-benefit analysis, requirements gathering and user training.')
p('<b>Technology:</b> Xero, MYOB, Microsoft Excel (PivotTables, XLOOKUP, Power Query), Power BI dashboards and Microsoft 365.')
heading('PROFESSIONAL EXPERIENCE')
p('Accountant | Banksia Business Advisory, Melbourne | Jul 2023 - Present', 'ResumeJob')
bullet('Manage monthly reporting, general ledger reconciliations and cash-flow forecasts for 18 small-business clients across professional services and retail.')
bullet('Prepare financial statements and supporting schedules; explain budget variances and working-capital issues to business owners in monthly review meetings.')
bullet('Interview clients about invoicing and reporting needs, document workflow requirements and coordinate with software providers during cloud accounting setup.')
bullet('Compare three accounting software options using subscription costs, reporting features and estimated time savings; present recommendations in plain language.')
bullet('Support eight client migrations to Xero and deliver onboarding sessions for 20 users, reducing follow-up data-entry corrections by 25% over three months.')
bullet('Build Excel and Power BI reports that reduce monthly reporting preparation time by 30% and help clients monitor overdue receivables.')
story.append(Spacer(1, 5))
p('Assistant Accountant | Southern Vale Wholesale, Melbourne | Jul 2021 - Jun 2023', 'ResumeJob')
bullet('Process accounts payable and receivable, reconcile bank accounts and assist with journal entries and month-end reporting for a wholesale business.')
bullet('Review aged receivables and resolve invoice queries with customers and account managers, helping reduce average payment collection time from 46 to 38 days.')
bullet('Analyse product margins and supplier costs in Excel; prepare weekly summaries used by finance and sales teams in pricing discussions.')
bullet('Create a MYOB process guide and train four colleagues on invoice coding and reconciliation procedures.')
heading('EDUCATION')
p('<b>Bachelor of Business (Accounting)</b> | Melbourne, Australia | Completed 2021')
p('Relevant study: Financial Accounting, Management Accounting, Business Information Systems and Business Communication.')
heading('PROFESSIONAL DEVELOPMENT')
p('Practical workplace training in Xero reporting, Power BI dashboard preparation and presenting financial insights to small-business clients.')

def footer(c, doc):
    c.saveState()
    c.setStrokeColor(colors.HexColor('#D7DEE3'))
    c.line(43, 37, A4[0]-43, 37)
    c.setFont('Helvetica', 7)
    c.setFillColor(colors.HexColor('#64748B'))
    c.drawString(43, 25, 'Fictional demonstration resume. Names, employers and achievements are invented for website testing.')
    c.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=43, leftMargin=43, topMargin=35, bottomMargin=48)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
reader = PdfReader(str(OUT))
assert len(reader.pages) == 1, f'Expected one page; got {len(reader.pages)}'
text = '\n'.join(page.extract_text() for page in reader.pages)
for expected in ['ACCOUNTANT', 'Xero', 'Assistant Accountant', 'EDUCATION', 'Fictional demonstration']:
    assert expected in text, expected
print(f'Created: {OUT}\nPages: {len(reader.pages)}\nExtracted characters: {len(text)}')
