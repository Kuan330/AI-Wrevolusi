
import StartWorkspaceButton from "./StartWorkspaceButton";

const HeroSection = () => {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-badge">
              Designed for women's career development
            </div>
            <h1>
              AI is changing your work,
              <br />
              but change is not only risk.
            </h1>
            <p className="lead">
              Start with your real tasks, review related skills, and choose
              one useful learning step.
            </p>
            <div>
              <StartWorkspaceButton />
            </div>
            <div className="hero-note">
              No CV upload · An account keeps your choices together
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
