import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import JourneyIntro from "@/components/account/JourneyIntro";
import { AppButton } from "@/components/ui/app-button";
import { courses, focusSkills } from "@/pages/LearningCentre/catalogue";
import { readSelections } from "@/pages/LearningCentre/resources";
import { readLibrary } from "@/pages/LearningCentre/lib/libraryStorage";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import {
  coursesForSkill,
  readLearningSkills,
  skillKey,
  type LearningSkill,
} from "@/pages/Skills/learningSkills";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { ROUTES } from "@/constants/routes";
import { accountStorage } from "@/services/accountStorage";
import { referenceService } from "@/services/referenceService";
import type { PlanState } from "@/pages/Plan/planModel";
import type { WefSkill } from "@/types/reference";
import "./skill-possibilities.css";

type SkillState = "current" | "building" | "explore";

type SkillItem = {
  id: string;
  name: string;
  note: string;
  state: SkillState;
  done?: number;
  total?: number;
  progressLabel?: string;
};

type Direction = {
  title: string;
  area: string;
  intro: string;
  current: string[];
  building: string[];
  needed: string[];
  copy: string;
};

const directions: Direction[] = [
  {
    title: "Marketing Analyst",
    area: "Analysis and insights",
    intro: "Use campaign, customer and market data to support marketing decisions.",
    current: ["Communication", "Analytical thinking", "Creative thinking"],
    building: ["Data Analysis", "AI and big data", "Data Visualization"],
    needed: ["Digital Literacy", "Critical Thinking", "Data Storytelling"],
    copy:
      "This direction connects your current communication and analysis experience with stronger data and visualisation skills.",
  },
  {
    title: "Business Analyst",
    area: "Business and change",
    intro:
      "Connect business needs, processes and data to support clearer decisions and change.",
    current: ["Communication", "Organisation", "Analytical thinking"],
    building: ["Data Analysis", "Technological literacy", "AI and big data"],
    needed: ["Requirements Analysis", "Process Mapping", "Digital Literacy"],
    copy:
      "This direction connects your communication, organisation and analytical strengths with process and requirements work.",
  },
  {
    title: "Project Coordinator",
    area: "Planning and delivery",
    intro:
      "Help teams stay aligned around schedules, actions, stakeholders and shared work.",
    current: ["Organisation", "Communication", "Leadership and social influence"],
    building: ["Project Management", "Technological literacy", "AI and big data"],
    needed: ["Project Tracking", "Stakeholder Management", "Digital Collaboration"],
    copy:
      "This direction builds on your organisation and communication strengths and connects them with structured project delivery.",
  },
];

const careerKey = "aiwrevolusi.possibilities.intent";

function readPlan(): PlanState | null {
  try {
    const state = JSON.parse(accountStorage.getItem("aiwrevolusi.planner.v1") ?? "null") as PlanState | null;
    const context = accountStorage.getItem("aiwrevolusi.confirmedAnalysis") ?? "";
    if (!state || state.version !== 1 || state.context !== context || !Array.isArray(state.events)) return null;
    return state;
  } catch {
    return null;
  }
}

function hasSkill(skills: SkillItem[], names: string[]) {
  const existing = new Set(skills.map((skill) => skillKey(skill.name)));
  return names.filter((name) => existing.has(skillKey(name)));
}

function directionScore(direction: Direction, current: SkillItem[], building: SkillItem[]) {
  return (
    hasSkill(current, direction.current).length * 2 +
    hasSkill(building, direction.building).length
  );
}

function savedDirection(): string {
  try {
    const data = JSON.parse(accountStorage.getItem(careerKey) ?? "null");
    return typeof data?.target === "string" ? data.target : "";
  } catch {
    return "";
  }
}

function saveDirection(direction: Direction | null, currentRole: string) {
  try {
    if (!direction) {
      accountStorage.removeItem(careerKey);
      return;
    }
    accountStorage.setItem(
      careerKey,
      JSON.stringify({
        version: 1,
        current: currentRole,
        target: direction.title,
        needed: direction.needed,
        source: "possibilities",
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // The selected direction still works for this visit when storage is blocked.
  }
}

const smooth = (value: number) => {
  const u = Math.max(0, Math.min(1, value));
  return u * u * (3 - 2 * u);
};

function strandX(spread: number, y: number) {
  return 200 + spread * smooth(y <= 268 ? (y - 112) / 156 : (448 - y) / 180);
}

function strandPath(spread: number, end: number) {
  const points: string[] = [];
  for (let y = 112; y < end; y += 6) points.push(`${strandX(spread, y)} ${y}`);
  points.push(`${strandX(spread, end)} ${end}`);
  return `M${points.join(" L")}`;
}

function SkillBridge({ skills, selected }: { skills: SkillItem[]; selected: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const motion = useRef({ t: 0, angle: 0 });
  const clipId = useId();
  const geometry = skills.map((skill, i) => ({
    ...skill,
    spread: skills.length > 1 ? -78 + 156 * i / (skills.length - 1) : 0,
    y: 268 + (i - (skills.length - 1) / 2) * 24,
    angle: -Math.PI / 2 + i / skills.length * Math.PI * 2,
  }));

  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    const target = selected ? 1 : 0;
    const chips = root.querySelectorAll<SVGGElement>(".ps-motion-chip");
    const tick = (time: number) => {
      const dt = last ? Math.min(64, time - last) : 0;
      last = time;
      const state = motion.current;
      if (media.matches) state.t = target;
      else {
        if (state.t === 0) state.angle += dt * .00022;
        state.t += Math.sign(target - state.t) * Math.min(Math.abs(target - state.t), dt / 900);
      }
      const e = smooth(state.t);
      root.querySelector(".ps-motion-head")?.setAttribute("transform", `translate(200,${250 - 168 * e}) scale(${1.5 - e})`);
      root.querySelector(".ps-motion-rings")?.setAttribute("opacity", String(1 - e));
      root.querySelector(".ps-motion-grow")?.setAttribute("height", String(336 * e));
      const cap = Math.max(0, (e - .55) / .45);
      root.querySelectorAll(".ps-motion-cap").forEach(node => node.setAttribute("opacity", String(cap)));
      root.querySelector(".ps-motion-bottom")?.setAttribute("transform", `translate(0,${(1 - smooth(cap)) * 22})`);
      chips.forEach((chip, i) => {
        const item = geometry[i];
        const ax = 200 + 88 * Math.cos(item.angle + state.angle);
        const ay = 250 + 72 * Math.sin(item.angle + state.angle);
        const bx = strandX(item.spread, item.y);
        const x = ax + (bx - ax) * e - Math.sin(Math.PI * e) * (bx - ax) * .12;
        chip.setAttribute("transform", `translate(${x},${ay + (item.y - ay) * e})`);
        const label = chip.querySelector("text")!;
        const orbit = e < .5;
        const right = item.spread >= 0;
        label.setAttribute("text-anchor", orbit ? "middle" : right ? "start" : "end");
        label.setAttribute("x", orbit ? "0" : right ? "11" : "-11");
        label.setAttribute("y", orbit ? "17" : "4");
      });
      if ((!media.matches && state.t === 0) || state.t !== target) frame = requestAnimationFrame(tick);
    };
    const restart = () => { cancelAnimationFrame(frame); last = 0; frame = requestAnimationFrame(tick); };
    restart();
    media.addEventListener("change", restart);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", restart); };
  }, [selected, JSON.stringify(skills)]);

  return <svg ref={svg} className="ps-motion-svg" viewBox="0 0 400 520" role="img" aria-label={selected ? "Skills forming a bridge to your chosen direction" : "Skills orbiting your current role"}>
    <defs><clipPath id={clipId}><rect className="ps-motion-grow" x="0" y="112" width="400" height="0" /></clipPath></defs>
    <g className="ps-motion-rings" fill="none">
      <ellipse cx="200" cy="250" rx="88" ry="72" stroke="#2a3459" strokeWidth=".5" strokeDasharray="3 6" />
      <ellipse cx="200" cy="250" rx="60" ry="49" stroke="#222b4a" strokeWidth=".5" strokeDasharray="2 7" />
    </g>
    <g clipPath={`url(#${clipId})`}>
      {geometry.map(item => <path key={item.id} className={`ps-motion-strand ${item.state}`} d={strandPath(item.spread, item.state === "explore" ? Math.min(item.y + 46, 448) : 448)} />)}
    </g>
    {geometry.map(item => <g key={item.id} className={`ps-motion-chip ${item.state}`}>
      <title>{item.name}</title><circle r="4" />
      <text>{item.name.length > 28 ? `${item.name.slice(0, 25)}...` : item.name}</text>
    </g>)}
    <g className="ps-motion-head"><circle cx="0" cy="-15" r="17" /><path d="M-27 30 C-27 8 -13 2 0 2 C13 2 27 8 27 30" /></g>
    <g className="ps-motion-cap" opacity="0"><text x="200" y="52" textAnchor="middle">CURRENT ROLE</text></g>
    <g className="ps-motion-cap ps-motion-bottom" opacity="0"><rect x="152" y="452" width="96" height="20" rx="10" /><text x="200" y="500" textAnchor="middle">DIRECTION I'M EXPLORING</text></g>
  </svg>;
}

export default function Possibilities() {
  const [analysis, setAnalysis] = useState(readConfirmedAnalysis);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [framework, setFramework] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(savedDirection);

  const learning = useMemo(() => {
    try {
      return {
        skills: readLearningSkills() ?? [],
        library: readLibrary(),
        plan: readPlan(),
        selections: readSelections(),
        error: "",
      };
    } catch {
      return {
        skills: [] as LearningSkill[],
        library: null,
        plan: null,
        selections: [],
        error: "Your learning choices could not be loaded. Please reload to try again.",
      };
    }
  }, [workspaceRevision]);

  useEffect(() => {
    const refresh = () => {
      setAnalysis(readConfirmedAnalysis());
      setSelected(savedDirection());
      setWorkspaceRevision(value => value + 1);
    };
    window.addEventListener("workspace-change", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("workspace-change", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    referenceService
      .wefSkills()
      .then((rows) => {
        if (active) setFramework(rows);
      })
      .catch(() => {
        if (active)
          setError("Your work skills could not be loaded. Please reload to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!analysis) return <JourneyIntro kind="possibilities" />;
  const confirmedAnalysis = analysis;

  const currentSkills: SkillItem[] = buildSkillEvidence(confirmedAnalysis.tasks, framework)
    .slice(0, 4)
    .map((item) => ({
      id: skillKey(item.skill.core_skill),
      name: item.skill.core_skill,
      note: item.tasks[0]?.wording
        ? `Connected to: ${item.tasks[0].wording}`
        : "Connected to your confirmed work tasks",
      state: "current",
    }));

  const currentKeys = new Set(currentSkills.map((skill) => skill.id));
  const pendingIds = new Set(learning.library?.pending.map((entry) => entry.courseId) ?? []);
  const planEvents = learning.plan?.events.filter((event) => event.kind === "learning") ?? [];

  // Build this panel from courses in the plan, independently of the Skills selection.
  const plannedResources = new Set([
    ...planEvents.flatMap(event => event.resourceId ? [event.resourceId] : []),
    ...[...pendingIds].map(id => `epic5-${id}`),
    ...learning.selections.map(selection => selection.resourceId),
  ]);
  const skillResources = new Map<string, { name: string; resources: Set<string> }>();
  for (const resourceId of plannedResources) {
    const course = courses.find(item => `epic5-${item.id}` === resourceId);
    const selection = learning.selections.find(item => item.resourceId === resourceId);
    const names = course
      ? course.skills.map(id => focusSkills.find(skill => skill.id === id)?.en).filter((name): name is string => Boolean(name))
      : selection?.skillName && selection.skillName !== "Learning" ? [selection.skillName] : [];
    for (const name of names) {
      const id = skillKey(name);
      const entry = skillResources.get(id) ?? { name, resources: new Set<string>() };
      entry.resources.add(resourceId);
      skillResources.set(id, entry);
    }
  }
  const plannedSkills: SkillItem[] = [...skillResources].map(([id, entry]) => {
    const events = planEvents.filter(event => event.resourceId && entry.resources.has(event.resourceId));
    const done = events.filter(event => event.completed).length;
    const total = events.length;
    const unscheduled = [...entry.resources].filter(resourceId => !events.some(event => event.resourceId === resourceId)).length;
    const percent = total ? Math.round(done / total * 100) : 0;
    return {
      id, name: entry.name, state: "building", done, total,
      progressLabel: !total ? "To schedule" : done === total ? (unscheduled ? "More to schedule" : "Plan completed") : done ? "In progress" : "Not started",
      note: total
        ? `${done} of ${total} scheduled sessions completed (${percent}%)${unscheduled ? ` · ${unscheduled} course(s) to schedule` : ""}`
        : "Added to My Plan · No sessions scheduled yet",
    };
  });
  const linkedResourceIds = new Set([...skillResources.values()].flatMap(entry => [...entry.resources]));
  const completedLearningSessions = planEvents.filter(event => event.completed && event.resourceId && linkedResourceIds.has(event.resourceId)).length;

  const buildingSkills: SkillItem[] = learning.skills
    .filter((skill) => !currentKeys.has(skill.id))
    .map((skill) => {
      const linkedCourses = courses.filter(
        (course) =>
          coursesForSkill(skill.id).includes(course.id) || course.skills.includes(skill.id),
      );
      const pendingCourses = linkedCourses.filter((course) => pendingIds.has(course.id));
      const relatedEvents = planEvents.filter((event) =>
        linkedCourses.some((course) => event.resourceId === `epic5-${course.id}`),
      );
      const selectedChapters = pendingCourses.reduce((sum, course) => {
        const choice = learning.library?.pending.find((entry) => entry.courseId === course.id)?.choice;
        return sum + (choice?.chapters.length || course.chapters?.length || 1);
      }, 0);
      const total = Math.max(selectedChapters, relatedEvents.length, pendingCourses.length ? 1 : 0);
      const done = relatedEvents.filter((event) => event.completed).length;
      return {
        id: skill.id,
        name: skill.name,
        note:
          total > 0
            ? `${done} of ${total} planned learning steps completed`
            : "Selected as a skill to build",
        state: "building" as const,
        done,
        total,
      };
    })
    .slice(0, 4);

  const fallbackCurrent: SkillItem[] =
    currentSkills.length || loading
      ? currentSkills
      : [
          "Communication",
          "Analytical thinking",
          "Organisation",
        ].map((name) => ({
          id: skillKey(name),
          name,
          note: "Example strength until work skills are available",
          state: "current" as const,
        }));

  const chosen =
    directions.find((direction) => direction.title === selected) ??
    directions
      .slice()
      .sort(
        (left, right) =>
          directionScore(right, fallbackCurrent, buildingSkills) -
          directionScore(left, fallbackCurrent, buildingSkills),
      )[0];
  const hasChosen = directions.some((direction) => direction.title === selected);
  const visibleDirections = directions
    .slice()
    .sort(
      (left, right) =>
        directionScore(right, fallbackCurrent, buildingSkills) -
        directionScore(left, fallbackCurrent, buildingSkills),
    );

  const selectedCurrent = hasSkill(fallbackCurrent, chosen.current);
  const selectedBuilding = hasSkill(buildingSkills, chosen.building);
  const pathSkills: SkillItem[] = [];
  const seen = new Set<string>();
  const addPathSkill = (skill: SkillItem, limit: number) => {
    const key = skillKey(skill.name);
    if (seen.has(key) || pathSkills.length >= limit) return;
    seen.add(key);
    pathSkills.push(skill);
  };
  fallbackCurrent.slice(0, 3).forEach(skill => addPathSkill(skill, 3));
  buildingSkills.forEach(skill => addPathSkill(skill, 5));
  if (hasChosen) chosen.needed.forEach(name => addPathSkill({
    id: skillKey(name), name, note: "Useful to explore next", state: "explore",
  }, 6));
  function choose(direction: Direction) {
    setSelected(direction.title);
    saveDirection(direction, confirmedAnalysis.occupationTitle);
    document.getElementById("chosen")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clear() {
    setSelected("");
    saveDirection(null, confirmedAnalysis.occupationTitle);
  }

  const renderSkill = (skill: SkillItem) => {
    const percent = skill.total ? Math.round(((skill.done ?? 0) / skill.total) * 100) : 0;
    return (
      <div className="ps-skill-row" key={`${skill.state}-${skill.id}`}>
        <div>
          <strong>{skill.name}</strong>
          <span>{skill.note}</span>
          {skill.state === "building" && skill.total ? (
            <div className="ps-progress" role="progressbar" aria-label={`${skill.name} learning progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div style={{ width: `${percent}%` }} />
            </div>
          ) : null}
        </div>
        <small className={`ps-state ${skill.state}`}>
          {skill.state === "current"
            ? "Current"
            : skill.state === "building"
              ? skill.progressLabel ?? "Building"
              : "Explore"}
        </small>
      </div>
    );
  };

  return (
    <div className="ps-page">
      <section className="ps-stage">
        <div className="ps-stage-copy">
          <p className="ps-kicker">Career possibilities</p>
          <h1>
            Explore your <span>possibilities</span>
          </h1>
          <p>
            Your current strengths and the skills you are building can connect
            to different directions. Choose one to explore and see how your
            learning changes that connection over time.
          </p>
          <div className="ps-stage-actions">
            <a href="#directions">Choose a direction</a>
            <Link to={ROUTES.plan}>View my plan</Link>
            <Link to={ROUTES.learningCentre}>Find learning resources</Link>
          </div>
          <div className="ps-meta">
            <div><b>{hasChosen ? 1 : 0}</b><span>saved direction</span></div>
            <div><b>{fallbackCurrent.length}</b><span>current strengths</span></div>
            <div><b>{buildingSkills.length}</b><span>skills building</span></div>
          </div>
        </div>
        <div className="ps-stage-stack" aria-hidden="true">
          <div className="ps-stack-card one">
            <span>Current role</span>
            <strong>{confirmedAnalysis.occupationTitle}</strong>
            <i />
          </div>
          <div className="ps-stack-card two">
            <span>Skills in motion</span>
            <strong>{buildingSkills.map((skill) => skill.name).slice(0, 3).join(" · ") || "Choose learning skills"}</strong>
            <i />
          </div>
          <div className="ps-stack-card three">
            <span>Direction I'm exploring</span>
            <strong>{hasChosen ? chosen.title : "Not chosen yet"}</strong>
            <i />
          </div>
        </div>
      </section>

      <p className="ps-notice">
        Career directions are illustrative skill connections. They do not
        represent job readiness, eligibility or hiring likelihood.
      </p>
      {learning.error ? <p className="ps-alert" role="alert">{learning.error}</p> : null}

      <div className="ps-journey">
        <aside className={`ps-rail ${hasChosen ? "is-bridged" : ""}`}>
          <p className="ps-rail-title">Your path forward</p>
          <span className="ps-rail-sub">
            {hasChosen
              ? `Bridging your current role to ${chosen.title}`
              : "Skills orbiting your current role. Pick a direction to build the bridge."}
          </span>
          <div className="ps-motion-canvas">
            <SkillBridge skills={pathSkills} selected={hasChosen} />
          </div>
          <div className="ps-readout">
            <b>{pathSkills.filter(skill => skill.state === "current").length}</b> confirmed <i>·</i>{" "}
            <b>{pathSkills.filter(skill => skill.state === "building").length}</b> building <i>·</i>{" "}
            <b>{pathSkills.filter(skill => skill.state === "explore").length}</b> to explore
            <div className="ps-motion-legend">
              <span><i className="current" />confirmed</span>
              <span><i className="building" />building</span>
              <span><i className="explore" />to explore</span>
            </div>
          </div>
          {hasChosen ? (
            <button className="ps-clear" type="button" onClick={clear}>
              Clear direction
            </button>
          ) : null}
          <p className="ps-fineprint">
            Strand thickness shows how much of this direction you already
            carry. It is not a job-readiness or hiring score.
          </p>
        </aside>

        <div className="ps-flow">
          <section className="ps-section" id="now">
            <div className="ps-section-head">
              <p className="ps-kicker">Where I am now</p>
              <h2>My strengths and learning</h2>
              <span>
                See what you already bring from your current work, and the
                skills you are actively building through your learning plan.
              </span>
            </div>
            <div className="ps-skill-shell">
              <div className="ps-skill-panel">
                <h3>Current strengths</h3>
                <p>Skills connected to your confirmed work</p>
                {loading ? <span className="ps-loading">Loading your work skills...</span> : fallbackCurrent.map(renderSkill)}
                {error ? <p className="ps-alert" role="alert">{error}</p> : null}
              </div>
              <div className="ps-skill-panel">
                <h3>Skills I'm building</h3>
                <p>Progress comes from your selected learning and plan</p>
                {plannedSkills.length ? (
                  plannedSkills.map(renderSkill)
                ) : (
                  <div className="ps-empty">
                    Add courses to My Plan to see your learning skills and progress here.
                  </div>
                )}
                <div className="ps-micro">
                  <span>{plannedSkills.length} learning skills</span>
                  <span>{completedLearningSessions} sessions completed</span>
                  <Link to={ROUTES.plan}>View My Plan</Link>
                </div>
              </div>
            </div>
          </section>

          <section className="ps-section short" id="directions">
            <div className="ps-section-head">
              <p className="ps-kicker">Follow your curiosity</p>
              <h2>Where could your skills take you?</h2>
              <span>
                These directions connect to combinations of your current and
                developing skills. Choose one direction to explore in more
                detail.
              </span>
            </div>
            <div className="ps-role-grid">
              {visibleDirections.map((direction) => {
                const current = hasSkill(fallbackCurrent, direction.current).length;
                const building = hasSkill(buildingSkills, direction.building).length;
                return (
                  <article
                    className={`ps-role-card ${selected === direction.title ? "selected" : ""}`}
                    key={direction.title}
                  >
                    <div className="ps-role-icon" aria-hidden="true" />
                    <p>{direction.area}</p>
                    <h3>{direction.title}</h3>
                    <span>{direction.intro}</span>
                    <div className="ps-connection">
                      <small>Your connection</small>
                      <strong>
                        {current} current strengths · {building} skills building
                      </strong>
                    </div>
                    <div className="ps-role-tags">
                      {[...direction.current, ...direction.building].slice(0, 4).map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                    </div>
                    <button type="button" onClick={() => choose(direction)}>
                      Choose this direction <span>→</span>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="ps-section" id="chosen">
            <div className="ps-section-head">
              <p className="ps-kicker">My chosen direction</p>
              <h2>See what connects you to this role</h2>
              <span>
                The connection becomes stronger when more relevant skills are
                already present, actively being learned, or completed.
              </span>
            </div>
            <div className="ps-chosen-wrap">
              <div className="ps-chosen-card">
                <h3>{hasChosen ? chosen.title : "No direction chosen yet"}</h3>
                <p>
                  {hasChosen
                    ? chosen.copy
                    : "Pick a direction above to see how your current strengths and the skills you are building connect to it."}
                </p>
                {hasChosen ? (
                  <>
                    <div className="ps-status">
                      Your connection grows when learning skills move into your
                      plan and get completed.
                    </div>
                    <div className="ps-match-list">
                      {[...selectedCurrent.map((name) => ({ name, state: "current" as const })), ...selectedBuilding.map((name) => ({ name, state: "building" as const }))].map((item) => (
                        <div key={`${item.state}-${item.name}`}>
                          <span>{item.name}</span>
                          <small className={`ps-state ${item.state}`}>
                            {item.state === "current" ? "Current strength" : "Building"}
                          </small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="ps-gap-card">
                <h3>Skills to explore next</h3>
                <p>
                  These are useful skills for this direction that are not yet
                  part of your current strengths or active learning.
                </p>
                <div className="ps-match-list">
                  {(hasChosen ? chosen.needed : []).map((name) => (
                    <div key={name}>
                      <span>{name}</span>
                      <small className="ps-state explore">To explore</small>
                    </div>
                  ))}
                  {!hasChosen ? <div><span>Choose a direction first</span><small className="ps-state explore">Next</small></div> : null}
                </div>
                <AppButton tone="gradient" asChild>
                  <Link to={ROUTES.learningCentre}>Find learning resources</Link>
                </AppButton>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
