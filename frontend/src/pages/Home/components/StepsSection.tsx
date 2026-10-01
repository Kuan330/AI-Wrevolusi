import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ui/scroll-reveal";
import { ROUTES } from "@/constants/routes";

const EXAMPLE_TASKS = [
  "Build pages from a design",
  "Implement page interactions",
  "Adapt layouts across screens",
];

const StepsSection = () => {
  return (
    <section className="section home-profile" id="steps" aria-labelledby="home-profile-title">
      <div className="container home-profile-grid">
        <ScrollReveal className="home-reveal" threshold={0.12}>
          <div className="home-profile-copy">
            <div className="home-eyebrow">01 / Your starting point</div>
            <h2 id="home-profile-title">Your work, in your words.</h2>
            <p className="home-profile-lead">
              Describe your role, then review, edit or add tasks. Only what you confirm becomes your work profile — the starting point for your AI analysis and learning.
            </p>
            <div className="home-profile-points">
              <span>Keep your own job title</span>
              <span>Change tasks any time</span>
            </div>
            <Link className="home-profile-link" to={ROUTES.aiExposure}>
              See AI impact and assistance
              <span className="home-profile-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </ScrollReveal>
        <ScrollReveal className="home-reveal" threshold={0.12} delay={120}>
          <article className="home-profile-card" aria-label="Example of confirmed work">
            <div className="home-profile-card-head">
              <div>
                <div className="home-profile-kicker">Your confirmed work</div>
                <h3>Front-end engineer</h3>
              </div>
              <span className="home-profile-example">Example</span>
            </div>
            <ul className="home-profile-list">
              {EXAMPLE_TASKS.map((task) => (
                <li key={task}>
                  <span className="home-profile-check" aria-hidden="true">✓</span>
                  {task}
                </li>
              ))}
            </ul>
            <div className="home-profile-foot">
              <span>Reviewed by you · Saved together</span>
              <span>One profile, reused throughout</span>
            </div>
          </article>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default StepsSection;
