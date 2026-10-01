
import StartWorkspaceButton from "./StartWorkspaceButton";

const CtaSection = () => {
  return (
    <section className="section" style={{ paddingBottom: 20 }}>
      <div className="container">
        <div className="cta-bottom">
          <h2>See the change - and the choices still yours.</h2>
          <p>A free account keeps your work review and learning choices together.</p>
          <StartWorkspaceButton />
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
