import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Sparkles, Trash2 } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import './learning-preview.css';

type Chapter = { title: string; value: number };
type Course = { id: string; title: string; provider: string; chapters: Chapter[] };
type RecordDay = { minutes: number; note: string; studied: boolean; checked: boolean };
type Preview = { courses: Course[]; records: Record<string, RecordDay> };
const KEY = 'aiwrevolusi.plan.learningPreview.v1';
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const emptyRecord = (): RecordDay => ({ minutes: 0, note: '', studied: false, checked: false });
const seedCourses: Course[] = [
  { id: 'demo-data', title: 'Data analysis essentials', provider: 'Example course · Analytical thinking', chapters: [{title:'Understanding data',value:10},{title:'Finding patterns',value:5},{title:'Explaining your findings',value:0}] },
  { id: 'demo-digital', title: 'Digital tools for everyday work', provider: 'Example course · Technological literacy', chapters: [{title:'Working with digital tools',value:10},{title:'Organising information',value:2},{title:'Collaborating online',value:0}] },
  { id: 'demo-project', title: 'Introduction to project planning', provider: 'Example course · Project planning', chapters: [{title:'Defining a goal',value:0},{title:'Breaking work into tasks',value:0},{title:'Tracking progress',value:0}] },
];
function initial(): Preview {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (value && Array.isArray(value.courses) && value.courses.every((c: Course) => typeof c.id==='string' && typeof c.title==='string' && Array.isArray(c.chapters) && c.chapters.every(ch => typeof ch.title==='string' && Number.isInteger(ch.value) && ch.value>=0 && ch.value<=10)) && value.records && typeof value.records==='object' && Object.values(value.records).every((r: unknown) => { const v=r as RecordDay; return v && Number.isFinite(v.minutes) && typeof v.note==='string' && typeof v.studied==='boolean' && typeof v.checked==='boolean'; })) return value;
  } catch { /* Start an isolated preview if storage is unavailable. */ }
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  return { courses: structuredClone(seedCourses), records: { [dateKey(yesterday)]: {minutes:25,note:'Practised organising information and finding patterns in data.',studied:true,checked:true} } };
}
const percent = (c: Course) => c.chapters.length ? Math.round(c.chapters.reduce((n,ch)=>n+ch.value,0)/(c.chapters.length*10)*100) : 0;
export default function Plan() {
  const [state,setState] = useState<Preview>(initial);
  const [today,setToday] = useState(dateKey);
  const [month,setMonth] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [courseId,setCourseId] = useState<string|null>(null);
  const [draft,setDraft] = useState<number[]>([]);
  const [recordDate,setRecordDate] = useState<string|null>(null);
  const [minutes,setMinutes] = useState('25');
  const [note,setNote] = useState('');
  const [notice,setNotice] = useState('');
  const [removeId,setRemoveId] = useState<string|null>(null);
  useEffect(() => { const refresh=()=>setToday(dateKey()); window.addEventListener('focus',refresh); const timer=window.setInterval(refresh,60000); return ()=>{window.removeEventListener('focus',refresh);window.clearInterval(timer);}; },[]);
  function save(next: Preview) { setState(next); try { sessionStorage.setItem(KEY,JSON.stringify(next)); } catch { setNotice('Changes are available until you leave this page; browser storage is unavailable.'); } }
  const course=state.courses.find(c=>c.id===courseId);
  const chapters=state.courses.flatMap(c=>c.chapters);
  const overall=chapters.length ? Math.round(chapters.reduce((n,c)=>n+c.value,0)/(chapters.length*10)*100):0;
  const monthPrefix=dateKey(month).slice(0,7);
  const checkedDays=Object.entries(state.records).filter(([day,r])=>day.startsWith(monthPrefix)&&r.checked).length;
  const totalMinutes=Object.values(state.records).reduce((n,r)=>n+r.minutes,0);
  const recommended=state.courses.filter(c=>percent(c)<100).sort((a,b)=>percent(a)-percent(b)).slice(0,2);
  function openCourse(c: Course) { setCourseId(c.id);setDraft(c.chapters.map(ch=>ch.value)); }
  function openRecord(day: string) { const r=state.records[day];setRecordDate(day);setMinutes(String(r?.minutes ?? 25));setNote(r?.note ?? ''); }
  function updateProgress() {
    if (!course) return;
    const changed=draft.some((v,i)=>v>course.chapters[i].value);
    const day=dateKey();
    save({...state,courses:state.courses.map(c=>c.id===course.id?{...c,chapters:c.chapters.map((ch,i)=>({...ch,value:Math.max(ch.value,draft[i])}))}:c),records:changed?{...state.records,[day]:{...(state.records[day]??emptyRecord()),studied:true}}:state.records});
    setCourseId(null);setToday(day);setNotice(changed?'Chapter progress saved. You can now check in for today.':'No changes to save.');
  }
  function checkIn() { const day=dateKey();const r=state.records[day];setToday(day);if(!r?.studied){setNotice('Update a chapter’s progress before checking in.');return;}save({...state,records:{...state.records,[day]:{...r,checked:true}}});setNotice('You are checked in for today. Well done!'); }
  const offset=(month.getDay()+6)%7;
  const dayCount=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  return <div className="lp-page">
    <PageHeader title="My Plan" description="Small steps, steady progress. Make your learning journey your own." actions={<Link className="lp-primary" to="/learning-centre">Choose courses <ArrowRight size={16}/></Link>}/>
    <div className="lp-demo"><strong>Design preview</strong><span>Example courses, progress and AI guidance. Changes stay in this tab and do not update your account.</span></div>
    <div className="lp-stats"><article><BookOpen/><strong>{overall}%</strong><span>Overall chapter progress</span></article><article><Check/><strong>{checkedDays} days</strong><span>Check-ins · {month.toLocaleDateString('en',{month:'long'})}</span></article><article><Clock3/><strong>{totalMinutes} min</strong><span>Recorded learning time</span></article></div>
    <p className="lp-notice" role="status">{notice}</p>
    <section className="lp-courses"><div className="lp-heading"><div><p className="lp-kicker">YOUR LEARNING JOURNEY</p><h2>My courses <span>{state.courses.length}</span></h2></div><Link to="/learning-centre">Explore resources <ArrowRight size={15}/></Link></div>
      {state.courses.length ? state.courses.map((c,i)=><article className={`lp-course lp-course-${i%3}`} key={c.id}><div className="lp-course-icon"><BookOpen size={22}/></div><div className="lp-course-main"><p>{c.provider}</p><h3>{c.title}</h3><div className="lp-progress-line"><progress value={percent(c)} max={100} aria-label={`${c.title} progress`}/><strong>{percent(c)}%</strong></div><small>{c.chapters.filter(ch=>ch.value===10).length} of {c.chapters.length} chapters completed</small></div><div className="lp-course-actions"><button className="lp-outline" onClick={()=>openCourse(c)}>View chapters</button><button className="lp-icon-button" aria-label={`Remove ${c.title}`} onClick={()=>setRemoveId(c.id)}><Trash2 size={16}/></button></div></article>):<div className="lp-empty"><h3>Your next chapter starts here</h3><p>Explore learning resources to find a course that interests you.</p><button className="lp-outline" onClick={()=>save({...state,courses:structuredClone(seedCourses)})}>Restore example courses</button></div>}
    </section>
    <section className="lp-guide"><div className="lp-guide-icon"><Sparkles/></div><div><p className="lp-kicker">YOUR AI STUDY GUIDE · EXAMPLE</p><h2>{state.records[today]?.checked?'A little progress goes a long way.':'Ready for your next small step?'}</h2><p>{recommended.length?'Start with the course below, then move on at your own pace. Try a 25-minute session today.':'You have no unfinished example courses. Explore a new course whenever you feel ready.'}</p><div className="lp-recommendations">{recommended.map((c,i)=><button key={c.id} onClick={()=>openCourse(c)}><span>{i===0?'Start here':'Then explore'}</span><strong>{c.title}</strong><small>{c.chapters.find(ch=>ch.value<10)?.title}</small><ArrowRight size={16}/></button>)}</div><small className="lp-guide-note">Preview guidance only. The 25-minute suggestion is illustrative, not generated by the live AI service. Adjust it to suit your day.</small></div></section>
    <section className="lp-today"><div><p className="lp-kicker">TODAY · {today}</p><h2>{state.records[today]?.checked?'You showed up for yourself today.':'How did your learning go?'}</h2><p>Update a chapter, record your learning, and check in.</p></div><div className="lp-today-actions"><button className="lp-outline" onClick={()=>openRecord(dateKey())}>Record learning</button><button className="lp-primary" disabled={!!state.records[today]?.checked} onClick={checkIn}>{state.records[today]?.checked?<><Check size={16}/> Checked in</>:'Check in today'}</button></div></section>
    <section className="lp-calendar"><div className="lp-heading"><div><p className="lp-kicker">EVERY SMALL STEP COUNTS</p><h2>Learning calendar</h2></div><div className="lp-month"><button aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button><strong>{month.toLocaleDateString('en',{month:'long',year:'numeric'})}</strong><button aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button></div></div><div className="lp-calendar-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span className="lp-weekday" key={d}>{d}</span>)}{Array.from({length:offset},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:dayCount},(_,i)=>{const day=dateKey(new Date(month.getFullYear(),month.getMonth(),i+1));const r=state.records[day];return <button key={day} disabled={day>today} className={`${day===today?'is-today ':''}${r?.checked?'checked':r?.studied?'studied':''}`} onClick={()=>openRecord(day)} aria-label={`${day}${r?.checked?', checked in':r?.studied?', learning recorded':''}`} aria-current={day===today?'date':undefined}><span>{i+1}</span>{r?.checked?<Check size={14}/>:r?.studied?<span className="lp-day-dot"/>:null}{r?.minutes>0&&<small>{r.minutes} min</small>}</button>;})}</div><div className="lp-legend"><span>● Checked in</span><span>◐ Learned, not checked in</span><span>Click a date to view your notes</span></div></section>
    <Dialog open={!!course} onOpenChange={v=>{if(!v)setCourseId(null);}}><DialogContent className="lp-modal"><DialogTitle>{course?.title}</DialogTitle><DialogDescription>Record each chapter from 0 to 10. Saved progress can only increase.</DialogDescription>{course?.chapters.map((ch,i)=><label className="lp-chapter" key={ch.title}><span>{i+1}. {ch.title}<strong>{draft[i]}/10</strong></span><input type="range" min={ch.value} max={10} step={1} value={draft[i]??ch.value} onChange={e=>setDraft(draft.map((v,n)=>n===i?Number(e.target.value):v))}/></label>)}<button className="lp-primary" onClick={updateProgress}>Save progress</button></DialogContent></Dialog>
    <Dialog open={!!recordDate} onOpenChange={v=>{if(!v)setRecordDate(null);}}><DialogContent className="lp-modal"><DialogTitle>Learning record · {recordDate}</DialogTitle><DialogDescription>Keep a note of what you learned. Saving a note does not mark chapters complete or check you in.</DialogDescription><form onSubmit={e=>{e.preventDefault();if(!recordDate)return;const value=Number(minutes);if(!Number.isInteger(value)||value<0||value>1440)return;save({...state,records:{...state.records,[recordDate]:{...(state.records[recordDate]??emptyRecord()),minutes:value,note:note.trim()}}});setRecordDate(null);setNotice('Learning record saved.');}}><label>Learning time (minutes)<input type="number" required min={0} max={1440} step={1} value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><label>What did you learn?<textarea rows={4} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="A small discovery, a useful idea, or something to revisit…"/></label><button className="lp-primary" type="submit">Save learning record</button></form></DialogContent></Dialog>
    <Dialog open={!!removeId} onOpenChange={v=>{if(!v)setRemoveId(null);}}><DialogContent className="lp-modal"><DialogTitle>Remove this example course?</DialogTitle><DialogDescription>Its chapter progress will be removed from this preview. Your daily notes and real account data will be kept.</DialogDescription><button className="lp-outline" onClick={()=>setRemoveId(null)}>Keep course</button><button className="lp-primary" onClick={()=>{save({...state,courses:state.courses.filter(c=>c.id!==removeId)});setRemoveId(null);setNotice('Example course removed.');}}>Remove course</button></DialogContent></Dialog>
  </div>;
}
