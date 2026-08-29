import SectionHeader from "@/components/ui/section-header";
import { STEPS } from "./homeData";

const StepsSection = () => {
  return (
    <section className="section" id="steps">
      <div className="container">
        <SectionHeader
          title='Not "will you be replaced?" - three questions instead'
          subtitle="A clearer path from uncertainty to a next step you can take."
        />
        <div className="steps-grid">
          {STEPS.map((step, index) => (
            <div key={step.title} className="step-card glass">
              <div className="step-num">{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <div className="step-bar">
                <div className="step-bar-fill" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StepsSection;
