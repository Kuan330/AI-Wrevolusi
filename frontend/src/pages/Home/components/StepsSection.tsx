import type { ComponentProps } from "react";
import type { CSSProperties } from "react";
import SectionHeader from "@/components/ui/section-header";
import { STEP_EVIDENCE, STEPS } from "./homeData";

const StepsSection = () => {
  const sectionHeaderProps1 = {
    title: "Understand Your Work. Know What to Do Next.",
    subtitle:
      "AI is changing work — but not every task, and not every skill, in the same way. Start from the work you actually do, and we’ll take it step by step to a plan that fits your real life.",
  } satisfies Partial<ComponentProps<typeof SectionHeader>>;
  return (
    <section className="section" id="steps">
      <div className="container">
        <SectionHeader {...sectionHeaderProps1} />
        <div className="steps-grid">
          {STEPS.map((step, index) => (
            <div className="step-flow-item" key={step.title}>
              <article className={`step-card glass step-card-${step.accent}`}>
                <div className="step-card-top">
                  <div className="step-num">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                </div>
                <h3>{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </article>
              {index < STEPS.length - 1 && (
                <div
                  className="step-connector"
                  aria-hidden="true"
                  style={
                    { "--step-delay": `${index * 160}ms` } as CSSProperties
                  }
                >
                  <span className="step-connector-icon">›</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="steps-evidence glass">
          <div className="steps-evidence-heading">
            <span className="steps-evidence-kicker">
              Evidence behind the flow
            </span>
            <p>
              Three references keep the journey grounded in your work and
              current research.
            </p>
          </div>
          <div className="steps-evidence-list">
            {STEP_EVIDENCE.map((item) => (
              <div className="steps-evidence-item" key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StepsSection;
