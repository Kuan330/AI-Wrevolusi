import { Link } from "react-router-dom";
import ScrollReveal from "@/components/ui/scroll-reveal";
import { ROUTES } from "@/constants/routes";

const PLAN_STEPS = [
  { title: "Pick your courses", text: "Free courses for the skill you chose." },
  { title: "Answer a few questions", text: "Your study days and how much time you have." },
  { title: "Get your plan", text: "Built from your courses and your answers." },
];

const PLAN_FEATURES = [
  { title: "Starts from your goal", text: "Linked to your tasks, career direction or a skill you chose." },
  { title: "Paced to your time", text: "Your daily minutes set how many study days you need." },
  { title: "Tracks each chapter", text: "Log progress, check in and get a short daily brief." },
];

const LearningPlanSection = () => {
  return (
    <section className="section home-plan" id="plan" aria-labelledby="home-plan-title">
      <div className="container home-plan-grid">
        <ScrollReveal className="home-reveal" threshold={0.12}>
          <div className="home-plan-copy">
            <div className="home-eyebrow">Your learning plan</div>
            <h2 id="home-plan-title">A plan made for you.</h2>
            <p className="home-plan-lead">Built from the courses you pick and the time you actually have.</p>
            <ol className="home-plan-steps">
              {PLAN_STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="home-plan-step-num" aria-hidden="true">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                </li>
              ))}
            </ol>
            <Link className="home-plan-link" to={ROUTES.learningCentre}>
              Start my learning plan
              <span className="home-plan-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </ScrollReveal>

        <div className="home-plan-features">
          {PLAN_FEATURES.map((feature, index) => (
            <ScrollReveal key={feature.title} className="home-reveal" threshold={0.12} delay={120 + index * 100}>
              <article className="home-plan-card">
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LearningPlanSection;
