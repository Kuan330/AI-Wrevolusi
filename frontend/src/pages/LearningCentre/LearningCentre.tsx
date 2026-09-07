import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Bookmark, Check, Clock3, Download, Globe2, Plus, Search, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ROUTES } from '@/constants/routes';
import { readLearningCentreItems } from '@/pages/Skills/skillDirections';
import { resources as catalogue, matches, readSelections, saveSelections, type Resource } from './resources';
import './learning-resources.css';
import { demoThemes, demoResources, demoSelections } from './demoData';

export default function LearningCentre() {
  const [params] = useSearchParams();
  // Dev default: show fictional demo content so the page can be previewed without Skills themes.
  // Use ?demo=0 to exit into the real (localStorage / curated) mode.
  const demo = import.meta.env.DEV && params.get('demo') !== '0';
  return <LearningResourcesContent key={String(demo)} demo={demo}/>;
}

function LearningResourcesContent({ demo }: { demo: boolean }) {
  const resources = demo ? demoResources : catalogue;
  const [themes] = useState(() => demo ? demoThemes : readLearningCentreItems());
  const [activeId, setActiveId] = useState(themes[0]?.theme_id ?? '');
  const [selected, setSelected] = useState(() => demo ? demoSelections : readSelections());
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState('All formats');
  const [provider, setProvider] = useState('All providers');
  const [detail, setDetail] = useState<Resource | null>(null);
  const [notice, setNotice] = useState('');
  const theme = themes.find(t => t.theme_id === activeId);
  const matching = theme ? resources.filter(r => matches(r, theme)) : [];
  const filtered = matching.filter(r => (format === 'All formats' || r.format === format) &&
    (provider === 'All providers' || r.provider === provider) &&
    `${r.title} ${r.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  function toggle(resource: Resource) {
    const exists = selected.some(s => s.resourceId === resource.id);
    if (!exists && !theme) return;
    const next = exists ? selected.filter(s => s.resourceId !== resource.id) : [...selected, {
      resourceId: resource.id, themeTitle: theme!.title, skillName: theme!.skill_name, addedAt: new Date().toISOString(),
    }];
    setSelected(next);
    try { if (!demo) saveSelections(next); setNotice(exists ? 'Resource removed from your shortlist.' : 'Resource saved to your shortlist.'); }
    catch { setNotice('Your selection is available this session, but could not be saved on this browser.'); }
  }
  function exportList() {
    const body = [demo ? 'DEMO LEARNING SHORTLIST — FICTIONAL RESOURCES' : 'MY LEARNING SHORTLIST', '', ...selected.flatMap(s => {
      const r = resources.find(r => r.id === s.resourceId)!;
      return [r.title, `Topic: ${s.themeTitle}`, `Skill: ${s.skillName}`, `Provider: ${r.provider}`, r.url, r.minutes ? `Example study time: ${r.minutes} minutes` : 'Study time: to be confirmed', ''];
    })].join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'my-learning-shortlist.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="lr-page">
    <PageHeader title="Learning Resources" description="Find your next learning step. Make room for it when you’re ready." actions={<Link className="lr-back" to={ROUTES.skills}><ArrowLeft size={16}/> Back to skills</Link>}/>
    {demo && <div className="lr-demo-banner"><div><strong>Demo preview</strong><span> Sample themes, fictional resources and example study times. Your own selections are unchanged.</span></div><Link to={`${ROUTES.learningCentre}?demo=0`}>Exit demo ↗</Link></div>}
    <div className="lr-journey"><span><Check size={13}/> Choose your skills</span><i/><strong>02 · Find resources</strong><i/><span>03 · Make a plan</span></div>
    <section className="lr-topics" aria-labelledby="topics-title">
      <div className="lr-section-heading"><div><p className="lr-eyebrow">CHOSEN BY YOU</p><h2 id="topics-title">Your learning themes</h2></div><Link to={ROUTES.skills}>Edit themes <ArrowUpRight size={15}/></Link></div>
      {themes.length ? <div className="lr-theme-tabs" aria-label="Learning themes">{themes.map(t => <button key={t.theme_id} aria-pressed={activeId === t.theme_id} onClick={() => {setActiveId(t.theme_id); setQuery(''); setFormat('All formats'); setProvider('All providers');}}>{t.title}</button>)}</div> : <div className="lr-empty"><BookOpen/><h3>Start with a skill you want to develop</h3><p>Choose a learning theme on the Skills page to find relevant resources here.</p><Link className="lr-primary" to={ROUTES.skills}>Choose learning themes <ArrowUpRight size={16}/></Link></div>}
    </section>
    <div className="lr-layout"><div className="lr-main">
      {theme && <>
        <section className="lr-context"><div className="lr-context-icon"><Sparkles size={22}/></div><div><p className="lr-eyebrow">YOUR NEXT CHAPTER</p><h2>{theme.title}</h2><p>{theme.description}</p><span className="lr-skill">{theme.skill_name}</span>{theme.why_relevant && <p className="lr-relevance">{theme.why_relevant}</p>}</div></section>
        <div className="lr-section-heading lr-results-heading"><div><h2>Resources for this theme</h2><p>A small selection of free learning content from established providers.</p></div><span className="lr-count">{filtered.length} found</span></div>
        <div className="lr-filters"><label className="lr-search"><Search size={16}/><input aria-label="Search resources" placeholder="Search within this theme" value={query} onChange={e => setQuery(e.target.value)}/></label><label><span className="sr-only">Resource format</span><select value={format} onChange={e => setFormat(e.target.value)}><option>All formats</option><option>Module</option><option>Course</option></select></label><label><span className="sr-only">Provider</span><select value={provider} onChange={e => setProvider(e.target.value)}><option>All providers</option>{Array.from(new Set(resources.map(r => r.provider))).map(p => <option key={p}>{p}</option>)}</select></label></div>
        <div className="lr-source-note"><Check size={14}/> {demo ? 'Demo content · English · Example data for layout preview' : 'Free content · English · Curated links checked 7 Sep 2026'}</div>
        <div className="lr-cards">{filtered.map(r => {
          const added = selected.some(s => s.resourceId === r.id);
          return <article className="lr-card" key={r.id}><div className="lr-card-top"><span className={`lr-provider-icon ${r.provider === 'OpenLearn' ? 'lr-ou' : ''}`}><BookOpen size={21}/></span><div><p className="lr-provider">{r.provider}</p><span className="lr-type">{r.format}</span></div><span className="lr-free">Free content</span></div><h3>{r.title}</h3><p className="lr-summary">{r.summary}</p><div className="lr-meta"><span><Globe2 size={14}/> English</span><span><Clock3 size={14}/> {r.minutes ? `${r.minutes} min · example` : 'See source for duration'}</span></div><div className="lr-match"><Sparkles size={15}/><span>Related to your selected skill: <strong>{theme.skill_name}</strong></span></div><div className="lr-card-actions"><button className="lr-text-button" onClick={() => setDetail(r)}>View details <ArrowUpRight size={15}/></button><button className={added ? 'lr-added' : 'lr-primary'} onClick={() => toggle(r)}>{added ? <Check size={16}/> : <Plus size={16}/>} {added ? 'Added to shortlist' : 'Add to shortlist'}</button></div></article>;
        })}</div>
        {!filtered.length && <div className="lr-empty lr-card"><SlidersHorizontal/><h3>{matching.length ? 'No resources match these filters' : 'We’re still finding resources for this theme'}</h3><p>{matching.length ? 'Try another format, provider or search term.' : 'Our starter collection does not cover every skill yet. Try another chosen theme.'}</p>{matching.length > 0 && <button className="lr-text-button" onClick={() => {setQuery(''); setFormat('All formats'); setProvider('All providers');}}>Clear filters</button>}</div>}
        <p className="lr-footnote">Learning takes place on the provider’s website. Check prerequisites and access conditions before starting.</p>
      </>}
    </div><aside className="lr-shortlist" aria-labelledby="shortlist-title"><div className="lr-shortlist-head"><span className="lr-bookmark"><Bookmark size={20}/></span><span className="lr-count">{selected.length} selected</span></div><h2 id="shortlist-title">My learning shortlist</h2><p>One small step is a good place to start.</p>
      <div aria-live="polite" className="sr-only">{notice}</div>
      {!selected.length ? <div className="lr-shortlist-empty"><BookOpen size={28}/><h3>Your next step starts here</h3><p>Add a resource that interests you. Your choices stay here as you explore other themes.</p></div> : <ul>{selected.map(s => { const r = resources.find(r => r.id === s.resourceId)!; return <li key={s.resourceId}><div><span>{s.skillName}</span><a href={r.url || undefined} onClick={e => {if (!r.url) {e.preventDefault(); setDetail(r);}}} role={!r.url ? "button" : undefined} tabIndex={0} onKeyDown={e => {if (!r.url && (e.key === "Enter" || e.key === " ")) {e.preventDefault(); setDetail(r);}}} target="_blank" rel="noopener noreferrer">{r.title} <ArrowUpRight size={13}/></a><small>{r.provider}</small></div><button aria-label={`Remove ${r.title}`} onClick={() => toggle(r)}><Trash2 size={16}/></button></li>; })}</ul>}
      {selected.length > 0 && <p className="lr-duration"><Clock3 size={16}/> {demo ? `${selected.reduce((total, s) => total + (resources.find(r => r.id === s.resourceId)?.minutes || 0), 0)} min total · example estimate` : 'Confirm study time with each provider.'}</p>}
      <button className="lr-primary lr-export" disabled={!selected.length} onClick={exportList}><Download size={16}/> Export my shortlist</button><p className="lr-save-note">{demo ? 'Demo selections reset on refresh. Export a copy to keep.' : 'Saved on this browser. Export a copy to keep.'}</p><div className="lr-next">{selected.length > 0 && <Link className="lr-primary" to={`${ROUTES.plan}${demo ? "" : "?demo=0"}`} state={{shortlist:selected}}>Arrange my learning <ArrowUpRight size={16}/></Link>}<p className="lr-eyebrow">NEXT · PLAN</p><h3>Make learning fit your day</h3><p>Bring your shortlist into My Plan to arrange study sessions alongside your daily activities.</p></div>
      {notice.includes('could not') && <p role="alert">{notice}</p>}
    </aside></div>
    <Dialog open={!!detail} onOpenChange={open => {if (!open) setDetail(null);}}><DialogContent className="lr-detail">{detail && <><p className="lr-eyebrow">{detail.provider} · {detail.format}</p><DialogTitle>{detail.title}</DialogTitle><DialogDescription>{detail.summary}</DialogDescription><div className="lr-detail-info"><h3>Before you begin</h3><p>{detail.access}</p><p>Language: English. Check the source for duration, level and prerequisites.</p><h3>Why it appears here</h3><p>This resource shares topic keywords with your selected learning theme. Review the outline to decide whether it fits your goal.</p></div>{detail.url && <a className="lr-primary" href={detail.url} target="_blank" rel="noopener noreferrer">Open provider website <ArrowUpRight size={16}/></a>}<button className="lr-text-button" onClick={() => toggle(detail)}>{selected.some(s => s.resourceId === detail.id) ? 'Remove from shortlist' : 'Add to my shortlist'}</button></>}</DialogContent></Dialog>
  </div>;
}
