import type { CSSProperties } from "react";
import SectionHeader from "@/components/ui/section-header";
import { STEPS } from "./homeData";

const StepsSection = () => {
  return (
    <section className="section" id="steps">
      <div className="container">
        <SectionHeader
          title="Understand Your Work. Know What to Do Next."
          subtitle="AI is changing work — but not every task, and not every skill, in the same way. Start from the work you actually do, and we’ll take it step by step to a plan that fits your real life."
        />
        <div className="steps-grid">
          {STEPS.map((step, index) => (
            <div className="step-flow-item" key={step.title}>
              <article className="step-card glass">
                <div className="step-card-top">
                  <div className="step-num">{String(index + 1).padStart(2, "0")}</div>
                  <div className="step-icon" aria-hidden="true">
                    <img src={step.icon} alt="" />
                  </div>
                </div>
                <h3>{step.title}</h3>
                <p className="step-description">{step.description}</p>
                <div className="step-divider" aria-hidden="true" />
                <p className="step-callout">{step.callout}</p>
                <p className="step-source">{step.source}</p>
              </article>
              {index < STEPS.length - 1 && (
                <div
                  className="step-connector"
                  aria-hidden="true"
                  style={{ "--step-delay": `${index * 160}ms` } as CSSProperties}
                >
                  <img
                    className="step-connector-icon"
                    src="/images/icons/icon-step-arrow.svg"
                    alt=""
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StepsSection;
