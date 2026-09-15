"""Build separately labelled proposed and future SVG screens for Figma import."""
from html import escape
from pathlib import Path
import json
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
INK = '#2F2430'
BLUE = '#4F91BA'
NAVY = '#3D5F7A'
MUTED = '#706976'
BORDER = '#D9DDE5'
PROPOSED = 'PROPOSED ITERATION 2 — NOT CURRENT BEHAVIOUR'
FUTURE = 'FUTURE CONCEPT — NOT COMMITTED'


class Screen:
    def __init__(self, width, height, title, future=False):
        self.width, self.height, self.title = width, height, title
        self.mobile = width < 500
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
                      f'<title>{escape(title)}</title>',
                      '<defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#EEF8FC"/><stop offset="1" stop-color="#FDF0F5"/></linearGradient></defs>']
        self.rect(0, 0, width, height, 'url(#background)', radius=0)
        self.rect(0, 0, width, 64, '#FFFFFF', radius=0)
        if self.mobile:
            self.rect(16, 14, 36, 36, '#F7F8FA', BORDER, 10)
            for y in (25, 31, 37): self.line(27, y, 41, y, INK)
            self.text(65, 40, 'AI-Wrevolusi', 19, 600)
            self.text(350, 39, '○', 20)
        else:
            self.text(32, 41, 'AI-Wrevolusi', 21, 650)
            for x, label in [(227, 'AI Exposure'), (365, 'Skills'), (450, 'Learning Resources'), (651, 'My Plan'), (762, 'Possibilities')]:
                active = label == ('Possibilities' if future else 'Learning Resources')
                if active: self.rect(x - 14, 13, 153 if label == 'Learning Resources' else 115, 38, '#EDF5FA', radius=20)
                self.text(x, 38, label, 14, 550, NAVY if active else INK)
            self.text(width - 58, 39, '○', 21)
        self.rect(0, 64, width, 34 if self.mobile else 36, '#FFF2DB' if not future else '#F0E9F7', radius=0)
        self.text(16 if self.mobile else 120, 86 if self.mobile else 88, FUTURE if future else PROPOSED, 10.8 if self.mobile else 12, 700, '#694B15' if not future else '#644D7A')

    def rect(self, x, y, w, h, fill='#FFFFFF', stroke=None, radius=16):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>' )

    def line(self, x1, y1, x2, y2, stroke=BORDER):
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}"/>')

    def text(self, x, y, value, size=14, weight=400, color=INK):
        self.parts.append(f'<text x="{x}" y="{y}" fill="{color}" font-family="Inter, Arial, sans-serif" font-size="{size}" font-weight="{weight}">{escape(value)}</text>')

    def lines(self, x, y, values, size=14, gap=23, color=INK, weight=400):
        for i, value in enumerate(values): self.text(x, y+i*gap, value, size, weight, color)

    def button(self, x, y, w, label, primary=False, small=False):
        h = 36 if small else 44
        self.rect(x, y, w, h, NAVY if primary else '#FFFFFF', None if primary else BORDER, 23)
        self.text(x+16, y+(24 if small else 28), label, 13 if small else 14, 550, '#FFFFFF' if primary else NAVY)

    def pill(self, x, y, w, label, fill='#EAF4FA', color=NAVY):
        self.rect(x, y, w, 26, fill, radius=13)
        self.text(x+11, y+18, label, 11, 600, color)

    def input(self, x, y, w, h, lines):
        self.rect(x, y, w, h, '#FFFFFF', BORDER, 12)
        self.lines(x+14, y+25, lines, 13, 21)

    def option(self, x, y, w, label, selected=False):
        self.rect(x, y, w, 43, '#DCEEF8' if selected else '#FBFCFE', '#93BCD2' if selected else BORDER, 13)
        self.text(x+13, y+27, '●' if selected else '○', 17, 400, BLUE if selected else MUTED)
        self.text(x+38, y+27, label, 13)

    def save(self, filename):
        content='\n'.join(self.parts)+ '\n</svg>\n'
        ET.fromstring(content)
        (OUT/filename).write_text(content)
        return {'file': filename, 'title': self.title, 'width': self.width, 'height': self.height}


def basis(mobile=False):
    s=Screen(390 if mobile else 1440, 844 if mobile else 1000, 'Review a recommendation draft — proposed Iteration 2')
    if mobile:
        s.text(20, 128, 'Review your learning focus', 21, 650)
        s.text(20, 151, 'Prototype example · Draft version 2', 12, 400, MUTED)
        s.rect(16, 169, 358, 603, '#FFFFFF', BORDER, 20)
        s.pill(32, 184, 160, 'Analytical thinking')
        s.text(32, 240, 'Your current foundation', 15, 600)
        s.option(32, 252, 154, 'Just starting', True)
        s.option(194, 252, 164, 'With support')
        s.option(32, 303, 154, 'Independent')
        s.option(194, 303, 164, 'Advanced')
        s.lines(32, 369, ['You choose this. It is not an AI', 'assessment of your ability.'], 12, 18, MUTED)
        s.text(32, 416, 'Relevant work evidence', 14, 600)
        s.lines(32, 440, ['✓ Prepare weekly sales reports', '✓ Check sales records for errors'], 12, 21)
        s.text(32, 486, 'From your confirmed tasks · Review tasks', 11, 500, NAVY)
        s.text(32, 524, 'Your learning goal', 14, 600)
        s.input(32, 537, 326, 72, ['Use evidence to improve my', 'weekly sales reports.'])
        s.lines(32, 634, ['Edit this goal, or keep your own wording.', 'An AI draft needs your confirmation.'], 12, 19, MUTED)
        s.line(32, 674, 358, 674)
        s.lines(32, 697, ['Confirm version 2 for new advice.', 'Keep chapter choices and study times.'], 12, 20, NAVY)
        s.button(20, 788, 126, 'Keep version 1')
        s.button(154, 788, 216, 'Confirm version 2', True)
    else:
        s.text(120, 147, 'Review your learning focus', 30, 650)
        s.text(120, 175, 'Review the draft before it is used for course advice. Your foundation and goal stay under your control.', 15, 400, MUTED)
        s.rect(120, 205, 762, 667, '#FFFFFF', BORDER, 24)
        s.pill(148, 229, 160, 'Analytical thinking')
        s.pill(321, 229, 195, 'Prototype example · Draft v2', '#F5EDF7', '#735A7C')
        s.text(148, 296, 'Your current foundation', 17, 600)
        s.option(148, 314, 337, 'Just starting', True)
        s.option(497, 314, 357, 'With support')
        s.option(148, 367, 337, 'Independent')
        s.option(497, 367, 357, 'Advanced')
        s.text(148, 436, 'Your self-confirmed starting point, not an AI assessment of proficiency.', 13, 400, MUTED)
        s.text(148, 484, 'Relevant work experience', 17, 600)
        s.text(148, 511, 'The draft uses these examples from your confirmed task list.', 14, 400, MUTED)
        s.rect(148, 529, 706, 88, '#F4F9FC', radius=14)
        s.lines(168, 560, ['✓ Prepare weekly sales reports', '✓ Check sales records for errors'], 14, 28)
        s.text(702, 603, 'Review tasks →', 13, 550, NAVY)
        s.text(148, 660, 'Your learning goal', 17, 600)
        s.button(684, 635, 170, 'Request a new draft', small=True)
        s.input(148, 680, 706, 94, ['Use evidence to improve my weekly sales reports.'])
        s.text(148, 801, 'Write your own goal or edit the draft. Only your confirmed wording is used.', 13, 400, MUTED)
        s.rect(906, 205, 414, 364, '#FFFFFF', BORDER, 24)
        s.text(934, 248, 'What you are confirming', 20, 600)
        s.lines(934, 284, ['Selected skill: Analytical thinking', 'Foundation: Just starting', 'Goal: Your edited wording', 'Evidence: Your confirmed work tasks'], 14, 33)
        s.line(934, 404, 1292, 404)
        s.lines(934, 436, ['Version 1 stays active until you confirm.', 'Version 2 becomes the basis for new advice.', 'Advice using version 1 will be marked old.'], 13, 25, MUTED)
        s.rect(906, 590, 414, 205, '#E9F4FA', radius=24)
        s.text(934, 634, 'Keep the choices you already made', 17, 600)
        s.lines(934, 671, ['Your saved courses, chapter choices and', 'study times stay as you set them.', 'AI guidance will not replace these choices.'], 14, 26, NAVY)
        s.button(966, 829, 158, 'Keep version 1')
        s.button(1136, 829, 184, 'Confirm version 2', True)
        s.text(120, 936, 'Proposed flow: review draft → confirm basis version → refresh course advice', 13, 500, NAVY)
        s.text(120, 962, 'This design does not claim that either proposed AI service is implemented.', 12, 400, MUTED)
    return s.save(f'proposed-basis-review-{"mobile" if mobile else "desktop"}.svg')


def advice(mobile=False):
    s=Screen(390 if mobile else 1440, 844 if mobile else 1000, 'Outdated course advice and retry — proposed Iteration 2')
    if mobile:
        s.text(20, 127, 'Course advice', 23, 650)
        s.text(20, 151, 'Pandas · Catalogue course', 13, 400, MUTED)
        s.rect(16, 169, 358, 563, '#FFFFFF', BORDER, 20)
        s.pill(32, 185, 188, 'Outdated · Based on version 1', '#FFF2DB', '#694B15')
        s.text(32, 241, 'Your learning focus has changed', 16, 600)
        s.lines(32, 266, ['You confirmed version 2. The older advice', 'below has not been updated.'], 12, 19, MUTED)
        s.rect(32, 319, 326, 89, '#FFF2F4', '#E8BEC5', 13)
        s.text(46, 345, 'The update failed', 14, 600, '#9B4556')
        s.lines(46, 369, ['Try again. Your confirmed goal and', 'selected chapters have been kept.'], 12, 18, '#834957')
        s.text(32, 444, 'Previous advice · Prototype example', 13, 600)
        s.lines(32, 470, ['Practise checking a small sales table.', 'Compare an AI suggestion with the', 'original records before using it.'], 13, 21)
        s.line(32, 533, 358, 533)
        s.text(32, 562, 'Advice sources', 14, 600)
        s.lines(32, 587, ['Work task: Check sales records for errors', 'Course source: Catalogue entry', 'Provider version: Unknown', 'Chapter reference: Not available'], 11.8, 23, MUTED)
        s.text(32, 704, 'Guidance does not verify provider claims.', 11, 500, NAVY)
        s.button(20, 747, 164, 'Review my focus')
        s.button(196, 747, 174, 'Retry advice', True)
        s.text(20, 819, 'Retry → Updating → Advice ready or Try again', 11, 400, MUTED)
    else:
        s.text(120, 146, 'Learning Resources', 28, 650)
        s.text(120, 174, 'Choose a course, review its information, and make room for learning.', 15, 400, MUTED)
        s.rect(120, 203, 440, 662, '#FFFFFF', BORDER, 22)
        s.text(146, 242, 'YOUR LEARNING FOCUS', 11, 650, NAVY)
        s.text(146, 281, 'Analytical thinking', 23, 600)
        s.pill(146, 305, 181, 'Confirmed basis · Version 2')
        s.text(146, 366, 'Your goal', 15, 600)
        s.lines(146, 395, ['Use evidence to improve my', 'weekly sales reports.'], 15, 25)
        s.text(146, 470, 'Your choices are kept', 15, 600)
        s.lines(146, 503, ['Saved course: Pandas', 'Selected content: Entire course', 'Study times: No change'], 14, 31, MUTED)
        s.button(146, 603, 170, 'Review my focus')
        s.rect(146, 693, 388, 141, '#F0F7FB', radius=16)
        s.lines(166, 723, ['Proposed change', 'Generated advice with version tracking', 'would replace current template guidance.', 'This is a design example, not a live result.'], 12, 26, NAVY)
        s.rect(588, 203, 732, 662, '#FFFFFF', BORDER, 22)
        s.text(617, 244, 'Pandas', 25, 600)
        s.text(617, 271, 'Catalogue course · Course facts and advice are separate', 13, 400, MUTED)
        s.line(617, 293, 1290, 293)
        s.pill(617, 310, 208, 'Outdated · Based on version 1', '#FFF2DB', '#694B15')
        s.text(617, 366, 'Your learning focus has changed', 20, 600)
        s.lines(617, 395, ['You confirmed version 2. The previous advice below is kept for reference.', 'It has not been updated to use your new goal.'], 14, 24, MUTED)
        s.rect(617, 440, 674, 106, '#FFF2F4', '#E8BEC5', 15)
        s.text(637, 471, 'The advice update failed', 16, 600, '#9B4556')
        s.lines(637, 497, ['Try again. Your confirmed details, chapter choices and schedule are kept.', 'An update never replaces your choices without your review.'], 13, 23, '#834957')
        s.text(617, 588, 'Previous advice · Prototype example', 15, 600)
        s.lines(617, 617, ['Practise checking a small sales table. Compare an AI suggestion with', 'the original records before using it in a weekly report.'], 14, 24)
        s.line(617, 663, 1291, 663)
        s.text(617, 693, 'Advice sources', 15, 600)
        s.lines(617, 720, ['Work task: Check sales records for errors', 'Course source: Catalogue entry · Provider version: Unknown', 'Chapter reference: Not available · Confirm with the provider'], 13, 24, MUTED)
        s.text(617, 820, 'Practical guidance is not a guarantee of course suitability.', 12, 400, MUTED)
        s.button(1143, 890, 177, 'Retry advice', True)
        s.text(120, 924, 'Proposed recovery: Retry advice → Updating advice → Advice ready, or retry after another failure', 13, 500, NAVY)
        s.text(120, 954, 'No provider facts, chapter references, AI output or service availability are presented as independently verified.', 12, 400, MUTED)
    return s.save(f'proposed-advice-retry-{"mobile" if mobile else "desktop"}.svg')


def future_career():
    s=Screen(1440, 1000, 'E7 career exploration — future concept', True)
    s.text(120, 148, 'Explore possibilities at your pace', 30, 650)
    s.text(120, 180, 'Start with the work you already know. Choose one direction to explore, without making a commitment.', 15, 400, MUTED)
    s.rect(120, 215, 355, 667, '#FFFFFF', BORDER, 24)
    s.text(148, 258, 'YOUR STARTING POINT', 11, 650, NAVY)
    s.text(148, 300, 'Sales supervisor', 24, 600)
    s.pill(148, 320, 140, 'Prototype example', '#F5EDF7', '#735A7C')
    s.text(148, 382, 'Experience you can build on', 16, 600)
    s.lines(148, 416, ['Customer relationships', 'Coordinating a small team', 'Preparing sales reports'], 14, 31)
    s.text(148, 543, 'Skill you are developing', 16, 600)
    s.pill(148, 565, 160, 'Analytical thinking')
    s.lines(148, 650, ['You can correct this starting point.', 'These examples do not assess your', 'ability or predict employment.'], 13, 25, MUTED)
    s.button(148, 790, 196, 'Review my experience')
    s.rect(499, 215, 821, 667, '#FFFFFF', BORDER, 24)
    s.text(527, 258, 'Choose a direction to learn about', 22, 600)
    s.text(527, 288, 'Example directions for a conversation, not ranked job matches.', 14, 400, MUTED)
    for i, (title, desc, selected) in enumerate([
        ('Sales operations', 'Explore how teams organise sales processes and use records.', True),
        ('Customer success', 'Explore how teams support customers and keep relationships.', False),
        ('Business reporting', 'Explore how teams turn work records into useful explanations.', False)]):
        y=316+i*116
        s.rect(527, y, 765, 99, '#EBF5FB' if selected else '#FCFCFE', '#91BCD4' if selected else BORDER, 17)
        s.text(548, y+34, title, 17, 600)
        s.text(548, y+64, desc, 13, 400, MUTED)
        s.text(1250, y+49, '●' if selected else '○', 18, 400, BLUE)
    s.text(527, 703, 'For this direction, explore', 16, 600)
    s.lines(527, 733, ['Process improvement · Clear reporting · Working with data', 'Check real role descriptions and requirements before deciding.'], 14, 27, MUTED)
    s.button(1042, 801, 250, 'Explore skills for this direction', True)
    s.text(120, 937, 'E7 · Exploration only. These examples are not career advice, verified vacancies or an employment prediction.', 13, 500, NAVY)
    return s.save('future-e7-career-desktop.svg')


def future_news():
    s=Screen(1440, 1000, 'E8 sourced AI updates — future concept', True)
    s.text(120, 148, 'AI updates that relate to your work', 30, 650)
    s.text(120, 180, 'Choose the topics you want to follow. Each update would show where it came from and when it was published.', 15, 400, MUTED)
    s.rect(120, 215, 388, 667, '#FFFFFF', BORDER, 24)
    s.text(148, 257, 'Your interests', 22, 600)
    s.text(148, 293, 'Work area', 14, 600)
    s.input(148, 309, 332, 46, ['Sales and customer relationships'])
    s.text(148, 395, 'Topics to follow', 14, 600)
    for i, topic in enumerate(['AI for spreadsheets', 'Checking AI output', 'Customer communication']):
        s.rect(148, 414+i*51, 332, 42, '#EEF6FA', BORDER, 12)
        s.text(162, 441+i*51, '✓  '+topic, 13)
    s.text(148, 610, 'How often', 14, 600)
    s.option(148, 627, 158, 'Weekly', True)
    s.option(315, 627, 165, 'Paused')
    s.lines(148, 711, ['Delivery channel is undecided.', 'This concept does not send updates.'], 13, 24, MUTED)
    s.button(148, 792, 229, 'Save example preferences', True)
    s.rect(532, 215, 788, 667, '#FFFFFF', BORDER, 24)
    s.pill(560, 238, 146, 'Source-first concept', '#F5EDF7', '#735A7C')
    s.rect(809, 325, 230, 144, '#EDF6FB', radius=25)
    s.rect(852, 353, 145, 91, '#FFFFFF', '#A7C9DC', 12)
    for yy, ww in [(376, 79), (393, 103), (410, 88)]: s.line(871, yy, 871+ww, yy, '#A7C9DC')
    s.text(725, 518, 'No sourced updates to show yet', 24, 600)
    s.lines(684, 554, ['No news stories have been added to this concept.', 'Your interests will help organise future updates.'], 15, 26, MUTED)
    s.rect(560, 644, 732, 171, '#F7F7FB', radius=17)
    s.text(585, 682, 'Each future update should include', 16, 600)
    s.lines(585, 716, ['A named source, a working source link and a publication date', 'A plain explanation of the effect on relevant tasks and skills', 'A Save action, with a clear way to change or pause preferences'], 14, 29, MUTED)
    s.text(120, 937, 'E8 · No live news feed, sourced articles, notification delivery or saved preference service is claimed.', 13, 500, NAVY)
    return s.save('future-e8-updates-empty-desktop.svg')


def future_care():
    s=Screen(1440, 1000, 'E9 language and care mode — future concept', True)
    s.text(120, 148, 'Make this feel familiar', 30, 650)
    s.text(120, 180, 'Choose how much detail you want to see, and return to the next step when you have time.', 15, 400, MUTED)
    s.rect(120, 215, 556, 667, '#FFFFFF', BORDER, 24)
    s.text(148, 257, 'Language and reading pace', 22, 600)
    s.text(148, 303, 'Language', 15, 600)
    s.input(148, 319, 500, 48, ['English · Current design language'])
    s.rect(148, 389, 500, 93, '#FFF4E4', radius=14)
    s.lines(168, 418, ['Supported languages are undecided.', 'Translation quality and review still need agreement.'], 13, 26, '#785827')
    s.text(148, 527, 'Care mode', 17, 600)
    s.rect(585, 503, 63, 31, BLUE, radius=16)
    s.rect(618, 507, 23, 23, '#FFFFFF', radius=13)
    s.lines(148, 558, ['Use shorter explanations and show one next step.', 'Keep a way to read the full detail.'], 14, 26, MUTED)
    s.text(148, 646, 'When the display changes', 16, 600)
    s.lines(148, 679, ['Keep my selected skill and learning goal.', 'Keep my chosen chapters and study times.', 'Return to the place where I stopped.'], 14, 30, MUTED)
    s.button(148, 792, 238, 'Preview these preferences', True)
    s.rect(700, 215, 620, 667, '#FFFFFF', BORDER, 24)
    s.pill(728, 238, 223, 'Example preview · Care mode on')
    s.text(728, 314, 'One useful step today', 26, 600)
    s.lines(728, 350, ['Review your learning goal.', 'You can change it before you choose a course.'], 16, 29, MUTED)
    s.rect(728, 427, 564, 179, '#EDF6FB', radius=20)
    s.text(752, 465, 'Your goal', 14, 600, NAVY)
    s.lines(752, 502, ['Use evidence to improve my', 'weekly sales reports.'], 22, 31, INK, 550)
    s.text(752, 580, 'Prototype example · Your wording stays editable', 12, 400, MUTED)
    s.button(728, 637, 182, 'Review my goal', True)
    s.button(922, 637, 140, 'Read details')
    s.rect(728, 720, 564, 114, '#FAF3F8', radius=17)
    s.text(751, 755, 'You can come back later', 16, 600)
    s.lines(751, 783, ['This preview shows the intended return experience.', 'It does not verify storage or reminders.'], 13, 23, MUTED)
    s.text(120, 937, 'E9 · Supported languages, translation review, reminder channels and delivery commitment remain undecided.', 13, 500, NAVY)
    return s.save('future-e9-language-care-desktop.svg')


assets=[basis(), basis(True), advice(), advice(True), future_career(), future_news(), future_care()]
(OUT/'manifest.json').write_text(json.dumps({'status': 'proposed design assets only', 'source_documents': ['../requirements-and-review.md', '../current-frontend-map.md'], 'application_integration': 'pending visual approval', 'assets': assets}, indent=2)+'\n')
cards='\n'.join(f'<article><h2>{escape(a["title"])}</h2><p>{a["width"]} × {a["height"]} · Editable SVG text and shapes</p><a href="{a["file"]}"><img loading="lazy" src="{a["file"]}" alt="{escape(a["title"])}"></a><p><a href="{a["file"]}">Open SVG</a></p></article>' for a in assets)
(OUT/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI-Wrevolusi · Proposed and future design assets</title><style>body{font-family:Inter,Arial,sans-serif;margin:0;background:linear-gradient(130deg,#edf7fc,#fff0f6);color:#2f2430}main{max-width:1440px;margin:auto;padding:40px 28px}h1{font-size:30px}p{line-height:1.6;color:#665e6c}a{color:#3d5f7a}article{background:white;border:1px solid #d9dde5;border-radius:20px;padding:24px;margin:28px 0}article h2{font-size:20px}img{width:auto;max-width:100%;max-height:860px;display:block;border:1px solid #eee}header{max-width:900px}</style><main><header><h1>Proposed Iteration 2 and future concepts</h1><p>These are separate design proposals. They do not replace the faithful current-frontend frames. Each screen visibly states its scope. No application integration, live AI result, news delivery or provider verification is claimed.</p><p>Use the current frontend captures as the reference for existing behaviour. These assets keep the current colour family, typography, rounded panels and header labels for context.</p></header>'''+cards+'</main></html>\n')
print(json.dumps({'xml_validated':len(assets), 'files':[a['file'] for a in assets]},indent=2))
