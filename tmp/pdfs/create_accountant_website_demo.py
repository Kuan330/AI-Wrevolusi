from pathlib import Path
import sys
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
BASELINE = '--baseline' in sys.argv
OUT = ROOT / 'output/pdf' / ('accountant-baseline-demo.pdf' if BASELINE else 'accountant-ict-sales-website-demo.pdf')
OUT.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
for name, config in {
    'Name': dict(fontName='Helvetica-Bold', fontSize=23, leading=27, spaceAfter=3, textColor=colors.HexColor('#17364A')),
    'Role': dict(fontName='Helvetica-Bold', fontSize=10, leading=14, spaceAfter=4),
    'Contact': dict(fontSize=9, leading=12, spaceAfter=7, textColor=colors.HexColor('#4B5563')),
    'Section': dict(fontName='Helvetica-Bold', fontSize=10, leading=13, spaceBefore=9, spaceAfter=4, textColor=colors.HexColor('#17364A')),
    'Text': dict(fontSize=9.4, leading=12.5, spaceAfter=3),
    'Job': dict(fontName='Helvetica-Bold', fontSize=9.4, leading=12.5, spaceAfter=3),
    'Bullet': dict(fontSize=9.4, leading=12.5, leftIndent=9, firstLineIndent=-9, spaceAfter=2),
}.items():
    styles.add(ParagraphStyle(name='Demo'+name, **config))
story=[]
def p(text, style='Text'): story.append(Paragraph(text, styles['Demo'+style]))
def h(text): p(text, 'Section')
def b(text): p('- '+text, 'Bullet')

p('ALEX MORGAN', 'Name')
p('ACCOUNTANT', 'Role')
p('Kuala Lumpur, Malaysia | alex.morgan@example.com', 'Contact')
h('PROFESSIONAL SUMMARY')
p('Accountant with five years of experience in financial reporting, budgets and client advisory. Uses Excel and cloud accounting software to improve reporting and explain financial results to business owners. Experienced in discussing client needs, comparing software costs and guiding users through accounting workflows.')
h('SKILLS')
SKILLS = [
    'Analytical thinking',
    'Technological literacy',
    'Service orientation and customer service',
    'Empathy and active listening',
    'Financial report writing',
    'Financial reporting',
    'Budgeting and forecasting',
    'Bank reconciliations',
    'Microsoft Excel',
    'Xero',
    'MYOB',
    'Client needs analysis',
]
if BASELINE:
    SKILLS = ['Financial reporting', 'Budgeting and forecasting', 'Bank reconciliations', 'Microsoft Excel', 'Xero', 'MYOB']
for skill in SKILLS: b(skill)
h('PROFESSIONAL EXPERIENCE')
p('Accountant | Meranti Business Advisory | Jul 2023 - Present', 'Job')
b('Prepare financial statements, monthly budgets and cash-flow forecasts for 12 small-business clients.')
b('Reconcile bank accounts and investigate reporting variances before monthly management reviews.')
b('Listen to client invoicing problems and document requirements for cloud accounting software.')
b('Explain software options and subscription costs to business owners using practical examples.')
b('Resolve client billing queries and coordinate follow-up with the software support team.')
story.append(Spacer(1, 4))
p('Assistant Accountant | Straits Wholesale | Jul 2021 - Jun 2023', 'Job')
b('Process invoices and payments in MYOB; maintain ledgers and assist with month-end reports.')
b('Check product margins in Excel and prepare cost summaries for finance and account managers.')
b('Explain invoice discrepancies to customers and agree follow-up actions with the finance team.')
h('PROJECTS')
p('Cloud Accounting Software Evaluation | Apr 2026', 'Job')
b('Interviewed six clients about invoicing needs and compared three cloud accounting packages.')
b('Prepared a cost-benefit report and demonstrated invoice workflows to six business owners.')
b('Guided four users through Xero setup and collected feedback for the software support team.')
story.append(Spacer(1, 3))
p('Monthly Reporting Improvement | Nov 2025', 'Job')
b('Reviewed 1,200 invoice records in Excel and corrected 24 duplicate entries.')
b('Created a reconciliation checklist that reduced monthly reporting time from five days to four.')
h('EDUCATION')
p('<b>Bachelor of Accounting</b> | Kuala Lumpur, Malaysia | Completed 2021')
p('Relevant study: Financial Accounting, Management Accounting and Business Information Systems.')

def footer(c, doc):
    c.saveState()
    c.setStrokeColor(colors.HexColor('#D7DEE3'))
    c.line(43, 45, A4[0]-43, 45)
    c.setFont('Helvetica-Bold', 7)
    c.setFillColor(colors.HexColor('#64748B'))
    c.drawString(43, 34, 'DISCLAIMER')
    c.setFont('Helvetica', 7)
    c.setFillColor(colors.HexColor('#64748B'))
    c.drawString(43, 26, 'Fictional resume for website demonstrations. Personal details, employers and achievements are invented.')
    c.restoreState()

class ResumeTemplate(SimpleDocTemplate):
    def afterPage(self):
        # Put footer text after the body in PDF reading order for the website parser.
        footer(self.canv, self)

ResumeTemplate(str(OUT), pagesize=A4, leftMargin=43, rightMargin=43, topMargin=31, bottomMargin=55).build(story)
pdf = PdfReader(str(OUT))
assert len(pdf.pages) == 1, f'Unexpected page count: {len(pdf.pages)}'
print(f'PDF: {OUT}\nPages: {len(pdf.pages)}\nBytes: {OUT.stat().st_size}')
