import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ui/scroll-reveal";
import { ROUTES } from "@/constants/routes";

type Tone = "done" | "current" | "muted";

const EXAMPLE_PROGRESS: { skill: string; value: number; tone: Tone }[] = [
  { skill: "AI-assisted development", value: 100, tone: "done" },
  { skill: "Interface quality review", value: 72, tone: "current" },
  { skill: "Workflow automation", value: 45, tone: "muted" },
  { skill: "Technical problem solving", value: 20, tone: "muted" },
];

const BAR_START_MS = 400;
const BAR_STAGGER_MS = 120;
const BAR_DURATION_MS = 1000;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const ProgressSection = () => {
  const cardRef = useRef<HTMLElement | null>(null);
  const [started, setStarted] = useState(false);
  const [counts, setCounts] = useState(() => EXAMPLE_PROGRESS.map(() => 0));

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStarted(true);
      setCounts(EXAMPLE_PROGRESS.map((row) => row.value));
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setStarted(true);
      const begin = performance.now();
      const tick = (now: number) => {
        const elapsed = now - begin;
        setCounts(EXAMPLE_PROGRESS.map((row, index) => {
          const t = (elapsed - BAR_START_MS - index * BAR_STAGGER_MS) / BAR_DURATION_MS;
          return Math.round(row.value * easeOut(Math.min(1, Math.max(0, t))));
        }));
        if (elapsed < BAR_START_MS + (EXAMPLE_PROGRESS.length - 1) * BAR_STAGGER_MS + BAR_DURATION_MS) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="section home-progress" id="progress" aria-labelledby="home-progress-title">
      <div className="container home-progress-grid">
        <ScrollReveal className="home-reveal" threshold={0.12}>
          <article
            ref={cardRef}
            className={`home-progress-card${started ? " is-running" : ""}`}
            aria-label="Example learning progress"
          >
            <div className="home-progress-card-head">
              <h3>Your progress</h3>
              <span className="home-progress-example">Example</span>
            </div>
            <ul className="home-progress-list">
              {EXAMPLE_PROGRESS.map((row, index) => {
                const finished = counts[index] >= row.value;
                const label = row.value === 100 ? "Complete" : `${row.value}%`;
                return (
                  <li
                    key={row.skill}
                    className={`home-progress-row ${row.tone}${finished && started ? " is-finished" : ""}`}
                    style={{ "--i": index, "--value": `${row.value}%` } as CSSProperties}
                    aria-label={`${row.skill}, ${label}`}
                  >
                    <div className="home-progress-row-top" aria-hidden="true">
                      <span className="home-progress-skill">
                        <span className="home-progress-check">✓</span>
                        {row.skill}
                      </span>
                      <span className="home-progress-value">
                        {row.value === 100 && finished ? "Complete" : `${counts[index]}%`}
                      </span>
                    </div>
                    <div className="home-progress-track" aria-hidden="true">
                      <span className="home-progress-fill" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </ScrollReveal>

        <ScrollReveal className="home-reveal" threshold={0.12} delay={120}>
          <div className="home-progress-copy">
            <div className="home-eyebrow">Track your progress</div>
            <h2 id="home-progress-title">Every step you take, counted.</h2>
            <p className="home-progress-lead">
              Log the chapters you finish. Your progress adds up by skill, so you always know where you are and what comes next.
            </p>
            <p className="home-progress-note">
              Check in on your learning calendar, and save a dated review to see what changed over time.
            </p>
            <Link className="home-progress-button" to={ROUTES.plan}>
              See my progress
              <span className="home-progress-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ProgressSection;
