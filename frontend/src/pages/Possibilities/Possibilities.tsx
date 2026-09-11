import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { AppButton } from '@/components/ui/app-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import JourneyIntro from '@/components/account/JourneyIntro';
import { readConfirmedAnalysis } from '@/pages/WorkProfile/userProfile';
import { buildSkillEvidence } from '@/pages/Skills/lib/skillProfile';
import { readLearningSkills, coursesForSkill, skillKey } from '@/pages/Skills/learningSkills';
import { readLibrary } from '@/pages/LearningCentre/lib/libraryStorage';
import { referenceService } from '@/services/referenceService';
import type { WefSkill } from '@/types/reference';
import { directions, matchDirections } from './skillDirections';
import './skill-possibilities.css';
export default function Possibilities() {
  const [analysis] = useState(readConfirmedAnalysis);
  const [framework, setFramework] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [detail, setDetail] = useState<(typeof directions)[number] | null>(null);
  const [learning] = useState(() => {
    try { return { skills: readLearningSkills() ?? [], pending: readLibrary().pending.map(item => item.courseId), error: '' }; }
    catch { return { skills: [], pending: [], error: 'Your learning choices could not be loaded. Please reload to try again.' }; }
  });
  useEffect(() => {
    let active = true;
    referenceService.wefSkills().then(rows => { if (active) setFramework(rows); })
      .catch(() => { if (active) setError('Your work skills could not be loaded. Please reload to try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (!analysis) return <JourneyIntro kind="possibilities" />;
  const work = buildSkillEvidence(analysis.tasks, framework).map(item => item.skill.core_skill);
  const current = new Set(work.map(skillKey));
  const planned = new Set(learning.skills.filter(skill => coursesForSkill(skill.id).some(id => learning.pending.includes(id))).map(skill => skill.id));
  const additions = learning.skills.filter(skill => !current.has(skill.id));
  const showLearning = expanded ?? additions.some(skill => planned.has(skill.id));
  const names = [...work, ...(showLearning ? additions.map(skill => skill.name) : [])];
  const results = matchDirections(names);
  const tags = (skills: string[]) => skills.map(name => {
    const extra = !current.has(skillKey(name));
    return <span key={name} className={extra ? 'ps-tag ps-tag-new' : 'ps-tag'}>{name}{extra ? (planned.has(skillKey(name)) ? ' · In your plan' : ' · Preview') : planned.has(skillKey(name)) ? ' · Strengthening' : ''}</span>;
  });
  return <div className="ps-page">
    <PageHeader title="Explore your possibilities" description={`Build on your experience in ${analysis.occupationTitle} and explore where your skills could take you.`} actions={<AppButton tone="gradient" asChild><Link to="/plan">Open My Plan</Link></AppButton>} />
    <section className="ps-basis">
      <div className="ps-basis-heading"><h2>Your skill starting point</h2>{!!additions.length && <div className="ps-switch" aria-label="Skill scenario"><button aria-pressed={!showLearning} onClick={() => setExpanded(false)}>Current skills</button><button aria-pressed={showLearning} onClick={() => setExpanded(true)}>With learning skills</button></div>}</div>
      {loading ? <p role="status">Loading your work skills…</p> : error ? <p role="alert">{error}</p> : <><div className="ps-tags">{tags(names)}</div>{!names.length && <p>No skills were identified from your confirmed tasks yet. <Link to="/skills">Review your skills →</Link></p>}<p className="ps-muted">{showLearning ? 'Pink skills show what you are developing or considering; they are not yet confirmed abilities.' : 'These skills are reflected in your confirmed work tasks.'}</p></>}
      {learning.error && <p role="alert">{learning.error}</p>}
    </section>
    {!loading && !error && <><div className="ps-results-heading"><h2>{showLearning ? 'Directions to explore as you learn' : 'Directions connected to your skills'}</h2><Link to="/skills#skill-directions">Adjust learning skills →</Link></div><p className="ps-muted">Exploration ideas based on skill associations, not a job eligibility assessment.</p>
      <div className="ps-results">{results.map(({ direction, matched }) => {
        const added = matched.filter(name => !current.has(skillKey(name)));
        return <article className="ps-direction" key={direction.title}><h3>{direction.title}</h3><div className="ps-tags">{tags(matched.slice(0, 3))}</div><p>{direction.description}</p>{!!added.length && <p className="ps-benefit">Developing {added.join(', ')} could help you explore this direction further.</p>}<button onClick={() => setDetail(direction)}>View details →</button></article>;
      })}</div>{!results.length && !!names.length && <p className="ps-basis">There are no direction associations for these skills yet. Add a learning skill to explore another starting point.</p>}</>}
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle><DialogDescription>{detail?.description}</DialogDescription></DialogHeader>{detail && <><h3 className="font-semibold">Skills connecting you to this direction</h3><div className="ps-tags">{tags(detail.skills.filter(name => names.some(item => skillKey(item) === skillKey(name))))}</div><h3 className="font-semibold">What to explore next</h3><p className="ps-muted">{detail.next}</p><p className="ps-muted">Compare actual role requirements with your experience, qualifications and examples of your work.</p><AppButton tone="gradient" asChild><Link to="/learning-centre">Explore learning resources →</Link></AppButton></>}</DialogContent></Dialog>
  </div>;
}
