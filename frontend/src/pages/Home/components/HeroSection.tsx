import { Link } from "react-router-dom";

import { ROUTES } from "@/constants/routes";

const HeroSection = () => {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-badge">Designed for women's career development</div>
            <h1>
              AI is changing your work,
              <br />
              but change is not only risk.
            </h1>
            <p className="lead">
              In about 5 minutes, see how tasks may change, where you are strong, and what
              to grow next.
            </p>
            <div>
              <Link to={ROUTES.workProfile} className="btn btn-warm">
                Start free analysis
              </Link>
            </div>
            <div className="hero-note">No CV upload - Results stay with you</div>
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
  );
};

export default HeroSection;
