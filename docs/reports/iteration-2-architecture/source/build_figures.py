"""Build editable, offline architecture figures from reviewed source evidence."""
from pathlib import Path
from html import escape
import json

OUT = Path(__file__).resolve().parents[1] / 'figures'
NAVY, TEAL, MUTED, LINE = '#17324d', '#087e8b', '#526575', '#bdcbd5'
class Figure:
    def __init__(self, slug, title, subtitle, w=1600, h=1000):
        self.slug,self.w,self.h=slug,w,h
        self.parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="{slug}-title {slug}-desc"><title id="{slug}-title">{escape(title)}</title><desc id="{slug}-desc">{escape(subtitle)}</desc><defs><marker id="{slug}-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="{TEAL}"/></marker></defs><rect width="100%" height="100%" fill="white"/>']
        self.text(48,42,'AI-WREVOLUSI  /  ITERATION 2',16,TEAL,weight=700)
        self.text(48,90,title,36,NAVY,weight=700)
        self.text(48,124,subtitle,17,MUTED)
    def text(self,x,y,s,size=20,color=NAVY,weight=400):
        self.parts.append(f'<text x="{x}" y="{y}" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(s)}</text>')
    def rect(self,x,y,w,h,fill='white',stroke=LINE,dashed=False):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.6"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>')
    def zone(self,x,y,w,h,title):
        self.rect(x,y,w,h,'#f7fafb',LINE,True);self.text(x+20,y+30,title,17,MUTED,700)
    def box(self,x,y,w,h,title,lines,accent=False):
        self.rect(x,y,w,h,'#ecf8f7' if accent else 'white',TEAL if accent else LINE)
        self.text(x+22,y+34,title,23,NAVY,700)
        for i,line in enumerate(lines): self.text(x+22,y+66+i*27,line,18,MUTED)
    def path(self,d,dotted=False,arrow=True):
        self.parts.append(f'<path d="{d}" fill="none" stroke="{TEAL}" stroke-width="2"'+(' stroke-dasharray="5 5"' if dotted else '')+(f' marker-end="url(#{self.slug}-arrow)"' if arrow else '')+'/>')
    def label(self,x,y,text):
        self.rect(x-5,y-19,len(text)*9.6+10,26,'white','none');self.text(x,y,text,16,TEAL,700)
    def footer(self,lines):
        y=self.h-80
        self.parts.append(f'<path d="M48 {y-16} H{self.w-48}" stroke="{LINE}"/>')
        for i,line in enumerate(lines):self.text(48,y+12+i*24,line,15,MUTED)
    def save(self):
        svg=''.join(self.parts)+'</svg>'
        (OUT/f'{self.slug}.svg').write_text(svg)
        (OUT/f'{self.slug}.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>'+self.slug+'</title><style>body{margin:0;background:white}svg{display:block}</style>'+svg+'</html>')

f=Figure('system-architecture','System architecture','Code and configuration view at aa4f8fb  •  No live deployment or database verification')
f.zone(48,168,432,578,'BROWSER  /  REACT + TYPESCRIPT')
f.zone(524,168,602,578,'VERCEL SERVICES  /  SAME ORIGIN')
f.zone(1170,168,382,578,'EXTERNAL SERVICES')
# Connections precede nodes. Ports are separated and labels sit in open space.
f.path('M454 304 H550');f.label(481,277,'HTTPS')
f.path('M826 310 H866');f.path('M690 388 V445');f.label(704,424,'/api/*')
f.path('M1100 526 H1196');f.label(1134,503,'SQL')
f.path('M1100 598 H1150 Q1158 598 1158 606 V643 Q1158 651 1166 651 H1196')
f.path('M274 380 V432');f.label(291,408,'shared rules')
f.path('M108 380 V408 Q108 416 100 416 H62 Q54 416 54 424 V655 Q54 663 62 663 H74')
f.path('M990 836 H1540 Q1548 836 1548 828 V578 Q1548 570 1540 570 H1526',dotted=True);f.label(1068,814,'batch import')
f.box(74,232,380,148,'Pages and shared domains',['Work Profile · AI Impact · Possibilities','Learning Resources · My Plan','Shared profile and course operations'])
f.box(74,432,380,134,'Account workspace adapter',['Account-scoped data and revision','Local cache and API synchronization'])
f.box(74,610,380,106,'Device preferences',['Pet position and local tour state'])
f.box(550,232,276,156,'Same-origin routing',['/api/* → backend','Other paths → frontend','API requests carry cookies'])
f.box(866,232,234,156,'Frontend service',['Vite static build','React SPA','Fallback → index.html'])
f.box(550,445,550,253,'FastAPI backend',['Routers validate requests and account access','Domain rules and transaction handling','SQLAlchemy repositories and direct queries','AI gateway and skill clients stay server-side','UV lockfile and separate dependency groups'],True)
f.box(1196,432,330,154,'Neon PostgreSQL',['Configured DATABASE_URL','App records and JSON workspace','Reference catalogue and mappings'],True)
f.box(1196,620,330,96,'External AI providers',['Gateway and skill-direction calls'])
f.box(48,784,942,106,'Reference data preparation  /  separate developer workflow',['data/reference/import_from_raw.py  →  processed files  →  db/seed_reference.py'])
f.footer(['Arrows show request or dependency direction. The dotted path shows the separate offline data import workflow.', 'Local development uses ./dev and the Vite API proxy. Hosted routing shown from vercel.json, not verified production state.'])
f.save()

EVIDENCE = json.loads((Path(__file__).parent/'schema-evidence.json').read_text())
TABLES = {t['name']:t for t in EVIDENCE['tables']}

def entity(f,name,x,y,w,fields,h=None,note=None):
    h=h or 64+len(fields)*27
    t=TABLES[name]
    modeled=t['status'].startswith('model_')
    legacy=t['status'].startswith('legacy_')
    f.rect(x,y,w,h,'#f4f6f8' if legacy or modeled else 'white',MUTED if legacy or modeled else TEAL,dashed=modeled)
    f.text(x+18,y+31,name,21,NAVY,700)
    f.parts.append(f'<path d="M{x} {y+46} H{x+w}" stroke="{LINE}"/>')
    for i,s in enumerate(fields):f.text(x+18,y+73+i*25,s,18,MUTED)
    if note:f.text(x+18,y+h-14,note,16,TEAL)

def edge(f,d,start,end,dotted=False):
    f.path(d,dotted=dotted,arrow=False)
    for x,y,text in (start,end):f.label(x,y,text)

def erfooter(f,more='Selected key fields shown. Full columns and source evidence are in source/schema-evidence.json.'):
    f.footer(['PK = primary key   FK = declared foreign key   UQ = unique   Solid = declared FK   Dotted = logical association only',more])

f=Figure('ERD-Identity-Learning','Identity and learning records','Current ORM relationships at aa4f8fb  •  Repeated app_users boxes are the same table  •  No live database check',h=1100)
# Three independent bands repeat the parent anchor rather than sharing hidden connector trunks.
rows=[(190,'app_accounts',['PK FK user_id','UQ username','workspace JSON','revision integer'],'refresh_tokens',['PK id','FK user_id','token_jti','expires_at / revoked_at']),
      (450,'learning_progress',['PK id','FK user_id','skill_id / course_id','chapter_index / value'],'learning_checkins',['PK id','FK user_id','checked_on','UQ user_id + checked_on']),
      (710,'daily_briefs',['PK id','FK user_id','brief_date / variant','content JSON'],'task_assist_interactions',['PK id','FK user_id','task_key / task_text','status / claim_token'])]
for y,a,af,b,bf in rows:
    edge(f,f'M350 {y+70} H540',(368,y+54,'1'),(468,y+54,'0..1' if a=='app_accounts' else '0..N'))
    edge(f,f'M240 {y+160} V{y+210} Q240 {y+218} 248 {y+218} H1322 Q1330 {y+218} 1330 {y+210} V{y+178}',(255,y+201,'1'),(1348,y+200,'0..N'))
    entity(f,'app_users',60,y,290,['PK id','email / full_name','FK occupation_id'],h=160)
    entity(f,a,540,y,430,af,h=178)
    entity(f,b,1120,y,420,bf,h=178)
# Notes outside the entity/connector area.
f.text(60,981,'Workspace stores JSON strings by key. task_key identifies a browser task, not tasks.id.',18,NAVY)
erfooter(f,'UQ learning_progress = user_id + skill_id + course_id + chapter_index. UQ daily_briefs = user_id + brief_date + variant.')
f.save()

f=Figure('ERD-Work-Planning','Work and planning records','Current ORM at aa4f8fb  •  Dashed table is modelled without an explicit current runtime write  •  No live database check',h=1100)
edge(f,'M420 280 H620',(434,263,'0..1'),(550,263,'0..N'))
edge(f,'M240 355 V500',(258,386,'0..1'),(258,478,'0..N'))
edge(f,'M650 355 V412 Q650 420 642 420 H358 Q350 420 350 428 V500',(666,387,'1'),(365,479,'0..N'))
edge(f,'M800 355 V500',(817,386,'1'),(817,479,'0..N'))
edge(f,'M980 280 H1120',(993,260,'1'),(1048,260,'0..N'))
edge(f,'M980 330 H1052 Q1060 330 1060 338 V560 Q1060 568 1068 568 H1120',(991,312,'1'),(1002,548,'0..N'))
edge(f,'M1330 355 V500',(1348,386,'1'),(1348,479,'0..N'))
edge(f,'M240 680 V812 Q240 820 248 820 H620',(256,714,'1'),(548,803,'0..N'))
edge(f,'M800 660 V780',(818,695,'1'),(818,758,'0..N'))
entity(f,'occupations',60,210,360,['PK id','masco_code / title','industry'],145)
entity(f,'app_users',620,210,360,['PK id','FK occupation_id','email'],145)
entity(f,'preparations',1120,210,420,['PK id','FK user_id','title / priority'],145)
entity(f,'tasks',60,500,360,['PK id','FK user_id','FK occupation_id nullable','title / status / exposure_type'],180)
entity(f,'capabilities',620,500,360,['PK id','FK user_id','name / evolution'],160)
entity(f,'schedules',1120,500,420,['PK id','FK user_id','FK preparation_id','planned_for / is_done'],190)
entity(f,'task_capability_link',620,780,420,['PK FK task_id','PK FK capability_id'],140)
f.text(60,980,'The ORM occupations table and reference ref_occupations table are distinct. Their codes are not joined by a declared FK.',18,NAVY)
erfooter(f,'All solid links are declared in ORM source. Optional occupation links use SET NULL. Other shown FK links use CASCADE.')
f.save()

f=Figure('ERD-Reference-Catalogue','Reference data and course catalogue','Active SQL reference tables and ORM catalogue at aa4f8fb  •  Logical associations do not imply database constraints',h=1100)
edge(f,'M800 390 V500',(818,421,'1'),(818,478,'0..N'))
edge(f,'M800 690 V790',(818,722,'1'),(818,768,'0..N'))
edge(f,'M260 580 V430',(278,557,'0..N'),(278,460,'0..1'),True)
edge(f,'M1140 600 H1010',(1025,580,'course code'),(1025,640,'logical'),True)
edge(f,'M1360 500 V308 Q1360 300 1352 300 H1010',(1120,280,'skill slug'),(1120,332,'logical'),True)
edge(f,'M1300 720 V852 Q1300 860 1292 860 H1010',(1100,840,'chapter order − 1'),(1100,889,'within the course'),True)
edge(f,'M460 868 H510 Q518 868 518 860 V368 Q518 360 510 360 H460',(478,850,'code'),(477,392,'logical'),True)
f.path('M100 230 V191 Q100 183 108 183 H392 Q400 183 400 191 V230',True,False);f.label(132,170,'parent_code hierarchy, no FK')
entity(f,'ref_occupations',60,230,400,['PK occupation_code','parent_code / level','title / skill_level','source / source_year'],200)
entity(f,'ref_ilo_tasks',60,580,400,['PK isco_08 + task_id','task_text / score_2025','potential25 / mean_score_2025'],180)
entity(f,'occupations',60,820,400,['PK id','masco_code'],120)
entity(f,'ref_wef_skills',590,230,420,['PK wef_skill_id','core_skill / wef_skill_group','importance / future trend fields'],160)
entity(f,'catalogue_courses',590,500,420,['PK id','UQ course_code','FK skill_id','title / provider / level'],190)
entity(f,'catalogue_chapters',590,790,420,['PK id','FK course_id','chapter_order / parent_order'],160)
entity(f,'learning_progress',1140,500,400,['PK id / FK user_id','course_id is a course code','skill_id is a normalized slug','chapter_index is zero-based','No catalogue FKs'],220)
f.text(60,980,'catalogue_chapters.parent_order is an optional within-course hierarchy value, not a declared self FK.',18,NAVY)
erfooter(f,'UQ catalogue_chapters = course_id + chapter_order. Reference table columns are declared in db/schema.sql.')
f.save()

f=Figure('ERD-Legacy','Legacy SQL model','Eight business tables in db/schema.sql at aa4f8fb  •  No current backend consumer found  •  Existence in live database unverified',h=1100)
edge(f,'M400 280 H600',(417,260,'1'),(529,260,'0..N'))
edge(f,'M680 370 V418 Q680 426 672 426 H268 Q260 426 260 434 V490',(696,405,'1'),(275,470,'0..N'))
edge(f,'M810 370 V490',(827,401,'1'),(827,468,'0..N'))
edge(f,'M1020 280 H1140',(1034,260,'1'),(1066,315,'0..N'))
edge(f,'M260 670 V770',(278,703,'1'),(278,748,'0..N'))
edge(f,'M810 670 V800',(827,704,'1'),(827,778,'0..N'))
edge(f,'M460 610 H510 Q518 610 518 618 V852 Q518 860 526 860 H600',(475,590,'1'),(526,839,'0..N'))
edge(f,'M1020 570 H1140',(1034,550,'1'),(1066,608,'0..N'))
entity(f,'users',60,210,340,['PK id','display_name'],140)
entity(f,'work_profiles',600,210,420,['PK id','FK user_id','occupation_code'],160)
entity(f,'review_events',1140,210,400,['PK id','FK work_profile_id','entity_type / action'],160)
entity(f,'profile_tasks',60,490,400,['PK id','FK work_profile_id','ilo_isco_08 / ilo_task_id','task_text / status'],180)
entity(f,'profile_wef_skills',600,490,420,['PK id','FK work_profile_id','wef_skill_id / wef_core_skill','interpretation'],180)
entity(f,'skill_examples',1140,490,400,['PK id','FK profile_wef_skill_id','example_text'],160)
entity(f,'task_assessments',60,770,400,['PK id','FK profile_task_id','suggested_state / reasoning'],160)
entity(f,'wef_skill_task_links',600,800,420,['PK FK profile_wef_skill_id','PK FK profile_task_id'],130)
f.text(60,980,'task_assessments has no unique profile_task_id constraint. The SQL permits zero or many assessments per task.',18,NAVY)
erfooter(f,'Grey entities are historical SQL declarations, not claimed active application storage. This is not a deletion recommendation.')
f.save()

f=Figure('ERD-Overview','Entity relationship overview','Current core storage at aa4f8fb  •  Selected key relationships only  •  Full 26-table source model appears in ERD.PNG',h=1100)
edge(f,'M400 310 H610',(416,290,'1'),(536,290,'0..1'))
edge(f,'M400 370 H470 Q478 370 478 378 V618 Q478 626 486 626 H610',(415,350,'1'),(535,605,'0..N'))
edge(f,'M260 440 V710',(276,476,'1'),(276,688,'0..N'))
edge(f,'M400 405 H435 Q443 405 443 413 V918 Q443 926 451 926 H610',(404,438,'1'),(535,904,'0..N'))
edge(f,'M1300 380 V490',(1317,412,'1'),(1317,468,'0..N'))
edge(f,'M1300 680 V790',(1317,715,'1'),(1317,768,'0..N'))
edge(f,'M1030 620 H1100',(1040,598,'code'),(1040,651,'logical'),True)
entity(f,'app_users',60,260,340,['PK id','email / full_name','FK occupation_id','User-owned records'],180)
entity(f,'app_accounts',610,230,420,['PK FK user_id','UQ username','workspace JSON / revision'],170)
entity(f,'learning_progress',610,530,420,['PK id / FK user_id','skill_id / course_id','chapter_index / value'],190)
entity(f,'learning_checkins',60,710,340,['PK id / FK user_id','checked_on','UQ user_id + checked_on'],170)
entity(f,'daily_briefs',610,820,420,['PK id / FK user_id','brief_date / variant','content JSON'],160)
entity(f,'ref_wef_skills',1100,230,440,['PK wef_skill_id','core_skill / group'],150)
entity(f,'catalogue_courses',1100,490,440,['PK id / UQ course_code','FK skill_id','title / provider'],190)
entity(f,'catalogue_chapters',1100,790,440,['PK id / FK course_id','chapter_order / title'],160)
f.text(62,198,'Identity and account workspace',20,NAVY,700);f.text(1102,198,'Learning reference catalogue',20,NAVY,700)
erfooter(f,'JSON workspace holds profile, saved learning and plan payloads. They are not separate relational tables in this schema.')
f.save()

# Compose readable panels without shrinking source type. Zoom the full sheet or use individual panels in print.
import re
panels=['ERD-Identity-Learning','ERD-Work-Planning','ERD-Reference-Catalogue','ERD-Legacy']
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="2200" viewBox="0 0 3200 2200" role="img" aria-labelledby="ERD-title ERD-desc"><title id="ERD-title">AI-Wrevolusi complete source schema</title><desc id="ERD-desc">All 26 source model tables across current identity, learning, work, reference and separate legacy domains, with declared foreign keys distinguished from logical associations.</desc>']
for i,name in enumerate(panels):
    content=(OUT/f'{name}.svg').read_text()
    content=re.sub(r'^<svg[^>]*>','',content).removesuffix('</svg>')
    parts.append(f'<g transform="translate({(i%2)*1600},{(i//2)*1100})">{content}</g>')
parts.append('</svg>');svg=''.join(parts)
(OUT/'ERD.svg').write_text(svg)
(OUT/'ERD.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Complete source ERD</title><style>body{margin:0;background:white}svg{display:block}</style>'+svg+'</html>')
# Stable filenames used by the report.
for suffix in ('svg','html'):
    old=OUT/f'system-architecture.{suffix}'
    old.rename(OUT/f'System-Architecture.{suffix}')
