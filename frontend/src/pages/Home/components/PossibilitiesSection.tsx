import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ui/scroll-reveal";
import { ROUTES } from "@/constants/routes";

interface Direction {
  id: string;
  title: string;
  area: string;
  description: string;
  match: number;
  have: string[];
  build: string[];
}

const EXAMPLE_DIRECTIONS: Direction[] = [
  {
    id: "fullstack",
    title: "Full-stack developer",
    area: "Software · Web",
    description: "Build both the pages people use and the services behind them.",
    match: 78,
    have: ["React", "UI design", "Testing"],
    build: ["APIs", "Databases"],
  },
  {
    id: "qa",
    title: "QA automation engineer",
    area: "Software · Quality",
    description: "Design automated checks that keep products reliable as they change.",
    match: 64,
    have: ["Testing", "Debugging"],
    build: ["Test frameworks", "CI"],
  },
  {
    id: "a11y",
    title: "Accessibility specialist",
    area: "Design · Web",
    description: "Make digital products usable for people of all abilities.",
    match: 52,
    have: ["UI design", "HTML"],
    build: ["WCAG", "Accessibility audits"],
  },
];

const RING_START_MS = 300;
const RING_STAGGER_MS = 120;
const RING_DURATION_MS = 1000;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const PossibilitiesSection = () => {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [counts, setCounts] = useState(() => EXAMPLE_DIRECTIONS.map(() => 0));
  const [goalId, setGoalId] = useState<string | null>(null);
  const goal = EXAMPLE_DIRECTIONS.find((item) => item.id === goalId);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCounts(EXAMPLE_DIRECTIONS.map((item) => item.match));
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const begin = performance.now();
      const tick = (now: number) => {
        const elapsed = now - begin;
        setCounts(EXAMPLE_DIRECTIONS.map((item, index) => {
          const t = (elapsed - RING_START_MS - index * RING_STAGGER_MS) / RING_DURATION_MS;
          return Math.round(item.match * easeOut(Math.min(1, Math.max(0, t))));
        }));
        if (elapsed < RING_START_MS + (EXAMPLE_DIRECTIONS.length - 1) * RING_STAGGER_MS + RING_DURATION_MS) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="section home-paths" id="possibilities" aria-labelledby="home-paths-title">
      <div className="container">
        <ScrollReveal className="home-reveal" threshold={0.12}>
          <div className="home-paths-heading">
            <div>
              <div className="home-eyebrow">Possibilities</div>
              <h2 id="home-paths-title">More doors than<br />you might think.</h2>
            </div>
            <div className="home-paths-intro">
              <p className="home-paths-lead">
                We match your skills with what other roles need and show your three closest directions. Pick one as your next goal, or keep growing where you are.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="home-paths-grid" ref={gridRef}>
          {EXAMPLE_DIRECTIONS.map((item, index) => {
            const selected = goalId === item.id;
            const muted = goalId !== null && !selected;
            return (
              <ScrollReveal key={item.id} className="home-reveal" threshold={0.12} delay={80 + index * 100}>
                <article className={`home-paths-card${selected ? " is-selected" : ""}${muted ? " is-muted" : ""}`}>
                  <div className="home-paths-card-top">
                    <div>
                      {index === 0 && <span className="home-paths-best">Best match</span>}
                      <h3>{item.title}</h3>
                      <div className="home-paths-area">{item.area}</div>
                    </div>
                    <div className="home-paths-ring" role="img" aria-label={`Skill match ${item.match}%`}>
                      <svg viewBox="0 0 64 64" aria-hidden="true">
                        <circle className="home-paths-ring-track" cx="32" cy="32" r="27" pathLength={100} />
                        <circle
                          className="home-paths-ring-value"
                          cx="32"
                          cy="32"
                          r="27"
                          pathLength={100}
                          strokeDasharray={`${counts[index]} 100`}
                        />
                      </svg>
                      <span aria-hidden="true">{counts[index]}%</span>
                    </div>
                  </div>
                  <p className="home-paths-desc">{item.description}</p>
                  <div className="home-paths-skills">
                    <div className="home-paths-skills-label">Skills you have</div>
                    <ul aria-label={`Skills you have for ${item.title}`}>
                      {item.have.map((skill) => (
                        <li key={skill} className="have"><span aria-hidden="true">✓</span>{skill}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="home-paths-skills">
                    <div className="home-paths-skills-label">Skills to build</div>
                    <ul aria-label={`Skills to build for ${item.title}`}>
                      {item.build.map((skill) => (
                        <li key={skill} className="build">{skill}</li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="home-paths-choose"
                    aria-pressed={selected}
                    onClick={() => setGoalId(selected ? null : item.id)}
                  >
                    {selected ? (
                      <><span aria-hidden="true">✓</span> Your new goal</>
                    ) : (
                      <>Set as my new goal <span className="home-paths-arrow" aria-hidden="true">→</span></>
                    )}
                  </button>
                </article>
              </ScrollReveal>
            );
          })}
        </div>

        <div className="home-paths-next" role="status" aria-live="polite">
          {goal && (
            <p key={goal.id}>
              Next: we&rsquo;ll use <strong>{goal.title}</strong> as your new goal for analysis and learning.
              <Link to={ROUTES.possibilities}>
                Continue <span className="home-paths-arrow" aria-hidden="true">→</span>
              </Link>
            </p>
          )}
        </div>

        <div className="home-paths-foot">
          <p>Match shows how many of this role&rsquo;s key skills you already have. It is not a hiring prediction.</p>
          <Link className="home-paths-stay" to={ROUTES.possibilities}>
            Or keep growing in your current role <span className="home-paths-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PossibilitiesSection;
