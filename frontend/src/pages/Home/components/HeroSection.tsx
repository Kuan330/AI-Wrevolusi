
import StartWorkspaceButton from "./StartWorkspaceButton";

const HeroSection = () => {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="hero-badge">
              FOR WORKING WOMEN IN MALAYSIA
            </div>
            <h1>
              <span className="hero-title-primary">Stay competitive.</span>
              <span className="hero-title-accent">As AI changes<br />your work.</span>
            </h1>
            <p className="lead">
              See how AI may affect the work you do. Build useful skills
              through free learning, and turn what you learn into progress at work.
            </p>
            <div className="hero-actions">
              <StartWorkspaceButton>Start with my work <span aria-hidden="true">↗</span></StartWorkspaceButton>
              <a className="hero-secondary-link" href="#steps">See how it works <span aria-hidden="true">→</span></a>
            </div>
            <div className="hero-note">
              Your role and everyday tasks are all you need to begin.
            </div>
          </div>
          <div className="hero-card glass-strong">
            <p className="hero-example-label">Example result</p>
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
              Example focus: <strong>judgement and collaboration</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
