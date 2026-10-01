import type { CSSProperties } from "react";
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
          <div className="hero-art" aria-label="Journey from your tasks through AI impact to learning">
            <div className="hero-halo" aria-hidden="true"><i className="orbit-dot" /></div>
            <svg className="hero-thread" viewBox="0 0 500 490" aria-hidden="true"><path d="M140 97 C455 50 500 170 354 260 S85 285 165 419" /></svg>
            <div className="hero-float one">
              <div className="art-label">Your work</div>
              <h3>A starting point that’s yours.</h3>
              <div className="hero-task-lines">
                <span><i className="mini-check" aria-hidden="true">✓</i>Your own role</span>
                <span><i className="mini-check" aria-hidden="true">✓</i>Tasks confirmed by you</span>
              </div>
            </div>
            <div className="hero-float two">
              <span className="hero-float-tag">Illustration</span>
              <div className="art-label">AI &amp; YOUR WORK</div>
              <h3>Understand the impact.</h3>
              <div className="mini-bars" aria-hidden="true">
                <div><span>Assist</span><i style={{ "--size": "78%" } as CSSProperties} /></div>
                <div><span>Judgement</span><i style={{ "--size": "54%" } as CSSProperties} /></div>
                <div><span>Explore</span><i style={{ "--size": "32%" } as CSSProperties} /></div>
              </div>
            </div>
            <div className="hero-float three">
              <div className="art-label">Your next move</div>
              <h3>Learn. Apply. Improve.</h3>
              <p>Relevant skills. Free learning. Progress you can check.</p>
            </div>
          </div>
        </div>
        <div className="hero-footer">
          <p>Different roles. A starting point in common: your real work.</p>
          <div className="work-types">
            <span><i aria-hidden="true">✧</i>Administration</span>
            <span><i aria-hidden="true">✧</i>Customer service</span>
            <span><i aria-hidden="true">✧</i>Marketing</span>
            <span><i aria-hidden="true">✧</i>Technology</span>
            <span><i aria-hidden="true">+</i>Your own role</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
