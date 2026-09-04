import { useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import Logo from "@/components/common/Logo";
import { ROUTES } from "@/constants/routes";
import "./systemDesign.css";

const FLOW_STEPS = [
  {
    number: "01",
    title: "Confirm the work",
    detail: "The user selects an occupation and reviews the tasks that reflect her actual role.",
  },
  {
    number: "02",
    title: "Send a typed request",
    detail: "The React client sends confirmed tasks to the versioned FastAPI assessment endpoint.",
  },
  {
    number: "03",
    title: "Match evidence",
    detail: "Backend services use exact task evidence first, then transparent TF-IDF and cosine similarity.",
  },
  {
    number: "04",
    title: "Return an explanation",
    detail: "The dashboard receives a suggested state, source, reasoning, uncertainty and limitations.",
  },
];

const COMPONENT_GROUPS = [
  {
    label: "Frontend",
    title: "Browser experience",
    body: "React 19, TypeScript, Vite and React Router render the public site, work profile, task confirmation and dashboard.",
    meta: "UI · client state · typed fetch",
  },
  {
    label: "Backend + NLP",
    title: "Explainable assessment",
    body: "FastAPI and Pydantic validate requests. Application services classify task change using traceable ILO evidence.",
    meta: "exact match · TF-IDF · cosine similarity",
  },
  {
    label: "Data",
    title: "Curated reference layer",
    body: "Async SQLAlchemy queries PostgreSQL tables populated from MASCO occupation, ILO task and WEF capability sources.",
    meta: "SQLAlchemy · asyncpg · Neon PostgreSQL",
  },
];

const BOUNDARIES = [
  "No CV upload is required in the current journey.",
  "Selected occupation and confirmed analysis are held in browser session or local storage.",
  "The public API is versioned under /api/v1 and routed separately from the frontend.",
  "No external large language model is part of the current production assessment path.",
];

const SystemDesign = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "System design — AI-Wrevolusi";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="system-design-page">
      <header className="system-design-nav">
        <Logo imageClassName="h-12" />
        <Link className="system-design-back" to={ROUTES.home}>
          <ArrowLeft aria-hidden="true" size={16} />
          Back to product
        </Link>
      </header>

      <main>
        <section className="system-design-hero">
          <div className="system-design-shell system-design-hero-grid">
            <div className="system-design-hero-copy">
              <p className="system-design-eyebrow">System design · current production</p>
              <h1>How AI-Wrevolusi turns confirmed work into explainable guidance.</h1>
              <p className="system-design-lead">
                A verified view of the frontend, backend, NLP matching and data boundaries behind the live product.
              </p>
              <a className="system-design-primary-link" href="#architecture">
                Explore the architecture
                <ArrowRight aria-hidden="true" size={16} />
              </a>
            </div>

            <dl className="system-design-facts" aria-label="Production technology summary">
              <div>
                <dt>Experience</dt>
                <dd>React + Vite</dd>
              </div>
              <div>
                <dt>Application API</dt>
                <dd>FastAPI + Pydantic</dd>
              </div>
              <div>
                <dt>Evidence logic</dt>
                <dd>Explainable NLP matching</dd>
              </div>
              <div>
                <dt>Persistence</dt>
                <dd>Neon PostgreSQL</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="system-design-section system-design-shell" id="architecture">
          <div className="system-design-section-heading">
            <div>
              <p className="system-design-eyebrow">Architecture overview</p>
              <h2>Production, expanded into its working parts.</h2>
            </div>
            <p>
              External datasets enter through a controlled import. They are not presented as live third-party APIs.
            </p>
          </div>

          <figure className="system-design-figure">
            <img
              src="/images/system-design/ai-wrevolusi-production-architecture.svg"
              alt="AI-Wrevolusi production architecture showing the React browser layer, Vercel and FastAPI services, explainable NLP matching, and PostgreSQL reference data."
            />
            <figcaption>
              Detailed current production architecture. Dashed connectors identify offline delivery or data-import paths.
            </figcaption>
          </figure>
        </section>

        <section className="system-design-section system-design-flow-section">
          <div className="system-design-shell">
            <div className="system-design-section-heading system-design-section-heading-light">
              <div>
                <p className="system-design-eyebrow">End-to-end flow</p>
                <h2>What happens after a user confirms her tasks.</h2>
              </div>
            </div>

            <ol className="system-design-flow">
              {FLOW_STEPS.map((step) => (
                <li key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="system-design-section system-design-shell">
          <div className="system-design-section-heading">
            <div>
              <p className="system-design-eyebrow">Component breakdown</p>
              <h2>Responsibilities stay separated.</h2>
            </div>
            <p>Each layer has one job and a visible hand-off to the next.</p>
          </div>

          <div className="system-design-components">
            {COMPONENT_GROUPS.map((group) => (
              <article key={group.label}>
                <p className="system-design-component-label">{group.label}</p>
                <h3>{group.title}</h3>
                <p>{group.body}</p>
                <span>{group.meta}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="system-design-section system-design-future-section">
          <div className="system-design-shell">
            <div className="system-design-section-heading">
              <div>
                <p className="system-design-eyebrow">Future services roadmap</p>
                <h2>Planned extensions, separated from production.</h2>
              </div>
              <div>
                <span className="system-design-status">Planned · not in production</span>
                <p>
                  These services come from the E4-E8 Final Design. Dashed borders keep roadmap intent visibly distinct from deployed components.
                </p>
              </div>
            </div>

            <figure className="system-design-figure system-design-future-figure">
              <img
                src="/images/system-design/ai-wrevolusi-future-services.svg"
                alt="AI-Wrevolusi future services roadmap showing planned correction, career direction, priority ranking, action planning and capacity-aware scheduling services."
              />
              <figcaption>
                Future services roadmap. E5 and E6 use planned AI or machine-learning methods; no external LLM is assumed.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="system-design-section system-design-boundary-section">
          <div className="system-design-shell system-design-boundary-grid">
            <div>
              <p className="system-design-eyebrow">Trust boundaries</p>
              <h2>What the diagram deliberately does not overclaim.</h2>
              <p>
                The system supports task-level guidance. It is not a job-loss prediction, hiring decision or readiness score.
              </p>
            </div>
            <ul>
              {BOUNDARIES.map((boundary) => (
                <li key={boundary}>
                  <CheckCircle2 aria-hidden="true" size={18} />
                  <span>{boundary}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="system-design-cta">
          <div className="system-design-shell">
            <p className="system-design-eyebrow">See the product flow</p>
            <h2>Start with your actual work, not a generic job title.</h2>
            <Link className="system-design-primary-link" to={ROUTES.workProfile}>
              Start free analysis
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="system-design-footer">
        <div className="system-design-shell">
          <span>AI-Wrevolusi</span>
          <span>FIT5120 Team 11 · United6</span>
          <span>Current production architecture</span>
        </div>
      </footer>
    </div>
  );
};

export default SystemDesign;
