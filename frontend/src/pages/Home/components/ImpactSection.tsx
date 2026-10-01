import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ui/scroll-reveal";
import { ROUTES } from "@/constants/routes";

type Level = "high" | "partial" | "human" | "unknown";
type Filter = Level | "all";

interface ExampleTask {
  id: string;
  name: string;
  level: Level;
  summary: string;
  change: string;
  assist: string;
  human: string;
}

const LEVEL_LABELS: Record<Level, string> = {
  high: "Highly AI-assisted",
  partial: "Partially AI-assisted",
  human: "Human-led",
  unknown: "No evidence",
};

const LEVEL_ORDER: Level[] = ["high", "partial", "human", "unknown"];

const UNKNOWN_SUMMARY = "There is not enough evidence to rate this task yet. You can still explore related skills.";

const EXAMPLE_TASKS: ExampleTask[] = [
  {
    id: "page",
    name: "Build pages from a design",
    level: "high",
    summary: "AI may help draft page code. Design decisions and quality checks still need you.",
    change: "Some repetitive page code could be drafted automatically when the requirements are clear. The whole task still includes integration and review.",
    assist: "Provide the design and constraints, ask for a component draft, then revise it against the project requirements.",
    human: "Interpret the design, check the interactions and decide whether the code is suitable for the project.",
  },
  {
    id: "interaction",
    name: "Implement page interactions",
    level: "partial",
    summary: "AI may suggest interaction logic. You decide how the page should behave.",
    change: "AI could suggest event handlers or state logic. Behaviour still depends on the user flow and the surrounding application.",
    assist: "Describe the expected behaviour and edge cases, request a draft, then test it in context.",
    human: "Decide what users should experience and check error states, usability and unexpected behaviour.",
  },
  {
    id: "layout",
    name: "Adapt layouts across screens",
    level: "high",
    summary: "AI may suggest layout rules. You check readability across screens.",
    change: "Repeated layout rules may be drafted with AI support. The assessment does not establish that a complete layout can be automated.",
    assist: "Share the layout constraints and ask for CSS suggestions, then inspect the page across the required screen sizes.",
    human: "Judge readability, visual hierarchy and accessibility across the intended devices.",
  },
  {
    id: "debug",
    name: "Investigate and fix page issues",
    level: "unknown",
    summary: UNKNOWN_SUMMARY,
    change: "This example has not assessed the task. Missing evidence does not establish either low impact or that the task is human-only.",
    assist: "A possible approach to try: share a reproducible issue and ask for hypotheses. Treat these as suggestions to verify.",
    human: "Reproduce the issue, locate the root cause and verify that a fix does not introduce new problems.",
  },
  {
    id: "tests",
    name: "Write and run tests",
    level: "unknown",
    summary: UNKNOWN_SUMMARY,
    change: "Impact remains unassessed in this example. Tool capability alone is not evidence of how your task will change.",
    assist: "Try asking for candidate test cases from clear requirements, then review and run them yourself.",
    human: "Define useful checks, identify missing cases and decide whether passing tests are enough for the task.",
  },
  {
    id: "docs",
    name: "Maintain project documentation",
    level: "human",
    summary: "AI may help draft documentation. You check its accuracy and relevance.",
    change: "AI could help draft summaries and repetitive documentation. Accuracy depends on the actual project and current behaviour.",
    assist: "Use approved project context to request a first draft, then check each claim against the implementation.",
    human: "Choose what readers need, verify accuracy and keep sensitive or outdated information out of the document.",
  },
];

// Homepage-only preview content. It deliberately does not claim to be a
// personalised recommendation until the task-to-skill ranking is connected.
const EXAMPLE_WORK_SKILLS = [
  {
    name: "AI-assisted development",
    description: "Use AI tools with clear context, review generated drafts, and adapt them to your project requirements.",
    tags: ["AI tools", "Prompting", "Development"],
  },
  {
    name: "Interface quality review",
    description: "Check AI-generated work against the design, user needs, and the quality standards of your product.",
    tags: ["Testing", "Accessibility", "Quality checks"],
  },
  {
    name: "Workflow automation",
    description: "Spot repeated steps and design useful workflows that save time while keeping your judgement in the process.",
    tags: ["Automation", "Workflows", "Process design"],
  },
  {
    name: "Technical problem solving",
    description: "Investigate issues, compare possible fixes, and verify that a change works across the full product.",
    tags: ["Debugging", "Analysis", "Testing"],
  },
];

const GROUPS = LEVEL_ORDER.reduce<{ level: Level; count: number; percent: number; offset: number }[]>((groups, level) => {
  const count = EXAMPLE_TASKS.filter((task) => task.level === level).length;
  const previous = groups[groups.length - 1];
  const offset = previous ? previous.offset + previous.percent : 0;
  return [...groups, { level, count, percent: (count / EXAMPLE_TASKS.length) * 100, offset }];
}, []);

const replay = (node: HTMLElement | null) => {
  if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  node.classList.remove("home-impact-swap");
  void node.offsetWidth;
  node.classList.add("home-impact-swap");
};

const ImpactSection = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [taskId, setTaskId] = useState(EXAMPLE_TASKS[0].id);
  const listRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const focusSelected = useRef(false);

  const visible = EXAMPLE_TASKS.filter((task) => filter === "all" || task.level === filter);
  const task = EXAMPLE_TASKS.find((item) => item.id === taskId) ?? EXAMPLE_TASKS[0];

  useEffect(() => {
    if (!focusSelected.current) return;
    focusSelected.current = false;
    listRef.current?.querySelector<HTMLButtonElement>(`[data-task="${taskId}"]`)?.focus();
  }, [filter, taskId]);

  const chooseTask = (id: string) => {
    setTaskId(id);
    replay(detailRef.current);
  };

  const chooseFilter = (level: Filter, restoreFocus = false) => {
    const next = filter === level ? "all" : level;
    const shown = EXAMPLE_TASKS.filter((item) => next === "all" || item.level === next);
    setFilter(next);
    if (shown.length && !shown.some((item) => item.id === taskId)) chooseTask(shown[0].id);
    replay(listRef.current);
    focusSelected.current = restoreFocus;
  };

  const segmentKey = (level: Level) => (event: KeyboardEvent<SVGCircleElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseFilter(level);
    }
  };

  const evidence = task.level === "unknown"
    ? "Selected task: no reference match in this example. Check the wording or seek more research before assigning a level."
    : `Selected task: the reference task and matching explanation are not connected in this preview. This is not evidence that ILO assigned this level to this task. ${task.change}`;

  return (
    <section className="home-impact" id="report" aria-labelledby="home-impact-title">
      <div className="container">
        <ScrollReveal className="home-reveal" threshold={0.12}>
          <div className="home-impact-heading">
            <div className="home-impact-head-copy">
              <div className="home-eyebrow">02 / AI impact analysis</div>
              <h2 id="home-impact-title">
                Which parts of your work
                <br />
                <em>could AI change most?</em>
              </h2>
              <p className="home-impact-lead">
                Using the tasks you confirm and research from the International Labour Organization (ILO), explore where AI may have more impact and how you could respond.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="home-reveal" threshold={0.08}>
          <div className="home-impact-window">
            <div className="home-impact-window-head">
              <div className="home-impact-window-title"><i aria-hidden="true" />How AI could help with your tasks</div>
              <div className="home-impact-window-meta">
                <span>Front-end engineer · {EXAMPLE_TASKS.length} confirmed tasks</span>
                <span className="home-impact-tag">Example preview</span>
              </div>
            </div>

            <div className="home-impact-grid">
              <aside className="home-impact-summary" aria-label="Example task impact summary">
                <h3>Task count by AI assistance</h3>
                <div className="home-impact-donut">
                  <svg viewBox="0 0 200 200" aria-label="Task count distribution; select a group to filter the list">
                    <defs>
                      <pattern id="home-impact-unknown-stripes" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                        <rect width="5" height="5" fill="#e0e4ed" />
                        <rect width="2" height="5" fill="#c3cbdc" />
                      </pattern>
                    </defs>
                    <circle className="home-impact-ring" cx="100" cy="100" r="84" />
                    {GROUPS.filter((group) => group.count > 0).map((group) => {
                      const length = Math.max(0, group.percent - 1.2);
                      return (
                        <circle
                          key={group.level}
                          className={`home-impact-segment ${group.level}${filter !== "all" && filter !== group.level ? " is-muted" : ""}`}
                          cx="100"
                          cy="100"
                          r="84"
                          pathLength={100}
                          strokeDasharray={`${length} ${100 - length}`}
                          strokeDashoffset={-(group.offset + 0.6)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={filter === group.level}
                          aria-controls="home-impact-task-list"
                          aria-label={`${LEVEL_LABELS[group.level]}: ${group.count} tasks`}
                          onClick={() => chooseFilter(group.level)}
                          onKeyDown={segmentKey(group.level)}
                        />
                      );
                    })}
                  </svg>
                  <div className="home-impact-donut-text">
                    <strong>{EXAMPLE_TASKS.length}</strong>
                    <span>tasks</span>
                  </div>
                </div>
                <div className="home-impact-legend" role="group" aria-label="Filter tasks by AI impact">
                  {GROUPS.map((group) => (
                    <button
                      type="button"
                      key={group.level}
                      className="home-impact-legend-row"
                      aria-pressed={filter === group.level}
                      aria-controls="home-impact-task-list"
                      onClick={() => chooseFilter(group.level)}
                    >
                      <i className={`home-impact-legend-mark ${group.level}`} aria-hidden="true" />
                      <span>{LEVEL_LABELS[group.level]}</span>
                      <b>{group.count}</b>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="home-impact-tasks">
                <div className="home-impact-table-top">
                  <span role="status" aria-live="polite">
                    {filter === "all"
                      ? `Your work tasks · ${EXAMPLE_TASKS.length}`
                      : `${LEVEL_LABELS[filter]} · ${visible.length} tasks`}
                  </span>
                  <button
                    type="button"
                    className="home-impact-show-all"
                    hidden={filter === "all"}
                    onClick={() => chooseFilter("all", true)}
                  >
                    View all tasks
                  </button>
                </div>

                <div id="home-impact-task-list" ref={listRef}>
                  {EXAMPLE_TASKS.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      data-task={item.id}
                      className="home-impact-task"
                      hidden={filter !== "all" && item.level !== filter}
                      aria-pressed={item.id === taskId}
                      aria-controls="home-impact-detail"
                      onClick={() => chooseTask(item.id)}
                    >
                      <span className="home-impact-task-name">
                        <span className="home-impact-task-num">{String(index + 1).padStart(2, "0")}</span>
                        <span>{item.name}</span>
                      </span>
                      <span className={`home-impact-level ${item.level}`}>
                        <i aria-hidden="true" />
                        <span>{LEVEL_LABELS[item.level]}</span>
                      </span>
                      <span className="home-impact-chevron" aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                <p className="home-impact-empty" hidden={visible.length > 0}>
                  No tasks in this group. Choose another group or view all tasks.
                </p>

                <div className="home-impact-detail" ref={detailRef} hidden={visible.length === 0}>
                  <div className="home-impact-detail-title">
                    <h3>{task.name}</h3>
                    <span className={`home-impact-detail-level ${task.level}`}>{LEVEL_LABELS[task.level]}</span>
                  </div>
                  <p className="home-impact-detail-summary">{task.summary}</p>
                  <div className="home-impact-detail-grid" id="home-impact-detail" aria-live="polite" aria-atomic="true">
                    <div className="home-impact-detail-piece">
                      <h4>AI can assist with</h4>
                      <p>{task.assist}</p>
                    </div>
                    <div className="home-impact-detail-piece">
                      <h4>Your judgement matters</h4>
                      <p>{task.human}</p>
                    </div>
                  </div>
                  <details className="home-impact-source">
                    <summary>View research basis</summary>
                    <p>Research reference: ILO Working Paper 140 (2025). The task levels and matches in this homepage example are illustrative; no real ILO task record is linked here. A live assessment should show the reference task, its source and matching explanation.</p>
                    <p className="home-impact-evidence">{evidence}</p>
                    <a href="https://www.ilo.org/resource/article/how-might-generative-ai-impact-different-occupations" target="_blank" rel="noopener noreferrer">
                      <span>Read the ILO method · 2025</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </details>
                </div>
              </div>
            </div>
            <div className="home-impact-disclaimer">
              <p>Figures and classifications are illustrative, not actual ILO findings. AI-use suggestions are provided separately.</p>
              <Link className="home-impact-skills" to={ROUTES.skills}>
                <span>Explore related skills</span>
                <span className="home-impact-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="home-reveal" threshold={0.08} delay={80}>
          <section className="home-work-skills" aria-labelledby="home-work-skills-title">
            <div className="home-work-skills-heading">
              <div>
                <div className="home-eyebrow">03 / skills for your work</div>
                <h2 id="home-work-skills-title">Skills that can support your work</h2>
              </div>
              <p>These example skills show how practical learning can help with tasks where AI may play a larger role.</p>
            </div>
            <div className="home-work-skills-grid">
              {EXAMPLE_WORK_SKILLS.map((skill) => (
                <article className="home-work-skill-card" key={skill.name}>
                  <h3>{skill.name}</h3>
                  <p>{skill.description}</p>
                  <ul aria-label={`Topics in ${skill.name}`}>
                    {skill.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                  <Link to={ROUTES.skills}>
                    <span>Explore learning path</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <div className="home-impact-bottom">
          <p>Learning can strengthen how you work with AI.</p>
          <Link className="home-impact-text-link" to={ROUTES.learningCentre}>
            <span>Pick courses for your plan</span>
            <span className="home-impact-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
