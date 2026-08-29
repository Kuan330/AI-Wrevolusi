import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

import Logo from "@/components/common/Logo";
import { ROUTES } from "@/constants/routes";

import "./home.css";

const NAV_LINKS = [
  { href: "#steps", label: "How it works" },
  { href: "#report", label: "Sample report" },
  { href: "#evidence", label: "Evidence" },
  { href: "#privacy", label: "Privacy" },
];

const FAQS = [
  {
    id: "evidence",
    question: "Where does the evidence come from?",
    answer:
      "Task-change scores follow ILO research on generative AI exposure (Gmyrek et al., 2025). Occupations use Malaysia’s MASCO classification. Capability language is aligned with the World Economic Forum Future of Jobs core skills. This is a task-change view, not a job-loss prediction.",
  },
  {
    id: "women",
    question: "Why is this designed for working women?",
    answer:
      "AI does not land evenly across occupations. Many women in Malaysia are concentrated in customer-facing and support roles where everyday tasks are already shifting. AI-Wrevolusi is built around those real tasks, so the next step is practical rather than generic.",
  },
  {
    id: "occupation",
    question: "What if my occupation is not in the list?",
    answer:
      "The pilot currently covers selected MASCO unit groups. You can still describe the tasks you actually do. Analysis is based on tasks, not job titles, so a missing title does not block a useful result.",
  },
  {
    id: "privacy",
    question: "Do you keep or train on my information?",
    answer:
      "You do not upload a CV. Your occupation and task profile stay in your workspace and are not used to train models. Results are for you to review and act on.",
  },
];

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" stroke="#4F91BA" strokeWidth="1.5" />
    <path d="M5 8l2 2 4-4" stroke="#4F91BA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Home = () => {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const applyHash = () => {
      const id = window.location.hash.replace("#", "");
      if (FAQS.some((item) => item.id === id)) {
        setOpenFaq(id);
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const toggleFaq = (id: string) => {
    setOpenFaq((current) => (current === id ? null : id));
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="nav-inner">
          <Logo />
          <div className="nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <Link to={ROUTES.workProfile} className="btn btn-primary btn-sm">
              Start free analysis
            </Link>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        <div className={`mobile-panel container ${mobileOpen ? "open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link to={ROUTES.workProfile} className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }}>
            Start free analysis
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-badge">Designed for women’s career development</div>
              <h1>
                AI is changing your work,
                <br />
                but change is not only risk.
              </h1>
              <p className="lead">
                In about 5 minutes, see how tasks may change, where you are strong, and what to grow next.
              </p>
              <div>
                <Link to={ROUTES.workProfile} className="btn btn-warm">
                  Start free analysis →
                </Link>
              </div>
              <div className="hero-note">No CV upload · Results stay with you</div>
            </div>
            <div className="hero-card glass-strong">
              <h3>Task-change snapshot</h3>
              <div className="number">
                6<span>everyday tasks may be changing</span>
              </div>
              <div className="bar-wrap">
                <div className="bar-fill" />
              </div>
              <ul className="task-list">
                <li className="assist">4 suit AI-assisted productivity</li>
                <li className="shift">2 need a new way of working</li>
              </ul>
              <div className="advantage">
                Your edge: <strong>judgement and collaboration</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="trust-bar">
          <div className="trust-item">
            <CheckIcon />
            No CV upload
          </div>
          <div className="trust-item">
            <CheckIcon />
            Not used to train models
          </div>
          <div className="trust-item">
            <CheckIcon />
            Based on your actual tasks
          </div>
        </div>
      </div>

      <section className="section" id="steps">
        <div className="container">
          <h2 className="section-title">Not “will you be replaced?” — three questions instead</h2>
          <p className="section-subtitle">A clearer path from uncertainty to a next step you can take.</p>
          <div className="steps-grid">
            <div className="step-card glass">
              <div className="step-num">1</div>
              <h3>Which tasks are changing?</h3>
              <p>Separate AI-assisted work, tasks that may be redesigned, and work that still needs you.</p>
              <div className="step-bar">
                <div className="step-bar-fill" />
              </div>
            </div>
            <div className="step-card glass">
              <div className="step-num">2</div>
              <h3>What makes you more valuable?</h3>
              <p>Surface judgement, communication, creativity, and domain experience you already use.</p>
              <div className="step-bar">
                <div className="step-bar-fill" />
              </div>
            </div>
            <div className="step-card glass">
              <div className="step-num">3</div>
              <h3>What should you do next?</h3>
              <p>Get a 90-day learning and action path that fits your time and career stage.</p>
              <div className="step-bar">
                <div className="step-bar-fill" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="report-section" id="report">
        <div className="container">
          <p className="report-label">
            Sample for a shop supervisor. Your result will follow the tasks you confirm.
          </p>
          <h2 className="report-title">A report you can actually act on</h2>
          <div className="report-grid">
            <div className="report-card glass">
              <h4>Task-change map</h4>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Work task</th>
                    <th>AI influence</th>
                    <th>Suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Competitor research</td>
                    <td>
                      <span className="tag tag-high">Higher</span>
                    </td>
                    <td>Let AI draft first</td>
                  </tr>
                  <tr>
                    <td>Cross-team coordination</td>
                    <td>
                      <span className="tag tag-low">Lower</span>
                    </td>
                    <td>Keep building influence</td>
                  </tr>
                  <tr>
                    <td>Strategy judgement</td>
                    <td>
                      <span className="tag tag-assist">AI-assisted</span>
                    </td>
                    <td>You keep the decision</td>
                  </tr>
                </tbody>
              </table>
              <div className="report-tip">Core reminder: roles rarely vanish overnight. Task mix changes first.</div>
            </div>
            <div className="report-card glass">
              <h4>Your 90-day action plan</h4>
              <ol>
                <li>
                  <strong>Days 1–30:</strong> Learn an AI research workflow
                </li>
                <li>
                  <strong>Days 31–60:</strong> Finish one real project
                </li>
                <li>
                  <strong>Days 61–90:</strong> Capture the outcome and show its value
                </li>
              </ol>
              <div className="report-tip">Each step can be adjusted to the options you actually have.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">What they said</h2>
          <p className="section-subtitle">Illustrative voices from women thinking through AI at work.</p>
          <div className="testimonials-grid">
            <div className="testimonial-card glass">
              <div className="testimonial-header">
                <div className="testimonial-avatar">A</div>
                <div className="testimonial-meta">
                  <div className="name">Admin officer</div>
                  <div className="role">Age 28</div>
                </div>
              </div>
              <blockquote>“I finally knew which skills to grow, instead of sitting with the anxiety.”</blockquote>
            </div>
            <div className="testimonial-card glass">
              <div className="testimonial-header">
                <div className="testimonial-avatar">H</div>
                <div className="testimonial-meta">
                  <div className="name">HR manager</div>
                  <div className="role">Age 35</div>
                </div>
              </div>
              <blockquote>“The report helped me walk into a promotion conversation with a plan.”</blockquote>
            </div>
            <div className="testimonial-card glass">
              <div className="testimonial-header">
                <div className="testimonial-avatar">D</div>
                <div className="testimonial-meta">
                  <div className="name">Designer</div>
                  <div className="role">Age 31</div>
                </div>
              </div>
              <blockquote>“Seeing an opportunity list, not a threat list, changed how I looked at AI.”</blockquote>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container">
          <h2 className="section-title">Frequently asked questions</h2>
          <p className="section-subtitle">Evidence, audience, and how your information is used.</p>
          <div className="faq-list">
            {FAQS.map((item) => (
              <div
                key={item.id}
                id={item.id}
                className={`faq-item${openFaq === item.id ? " open" : ""}`}
              >
                <button type="button" className="faq-q" onClick={() => toggleFaq(item.id)}>
                  {item.question}
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-a">
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingBottom: 20 }}>
        <div className="container">
          <div className="cta-bottom">
            <h2>See the change — and the choices still yours.</h2>
            <p>About 5 minutes · Free personal overview</p>
            <Link to={ROUTES.workProfile} className="btn btn-warm">
              Start free analysis →
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container">© 2026 AI-Wrevolusi. Designed for women’s career development.</div>
      </footer>
    </div>
  );
};

export default Home;
