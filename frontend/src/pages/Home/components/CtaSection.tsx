import StartWorkspaceButton from "./StartWorkspaceButton";

const CtaSection = () => {
  return (
    <section className="home-cta" aria-labelledby="home-cta-title">
      <div className="container">
        <div className="home-cta-card">
          <div>
            <h2 id="home-cta-title">Your next move starts with your work.</h2>
            <p>Understand the impact. Build relevant skills. Keep moving forward.</p>
          </div>
          <div className="home-cta-action">
            <StartWorkspaceButton>Start with my work <span aria-hidden="true">↗</span></StartWorkspaceButton>
            <span>Your role. Your tasks. Your starting point.</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
