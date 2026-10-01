import { useState } from "react";
import ScrollReveal from "@/components/ui/scroll-reveal";

const FAQS = [
  {
    question: "Are the courses free?",
    answer: "Yes. We focus on free learning content. The linked courses and tutorials are free to read; providers may have separate requirements for accounts, optional certificates or practice tools.",
  },
  {
    question: "Do I need experience with AI?",
    answer: "No. Start with your work, not an AI skill test. Describe what you do, then explore relevant skills and their prerequisites before choosing learning resources.",
  },
  {
    question: "What if my job title is not listed?",
    answer: "Keep your own title and describe your tasks in your words. Suggested occupations and tasks only become part of your profile after you review and accept them.",
  },
  {
    question: "Does an AI impact result mean my job will disappear?",
    answer: "No. Task-level research describes possible changes, not your personal employment outcome. Missing evidence is shown as no evidence, and an impact level is not a judgement of your ability.",
  },
  {
    question: "What happens when my work changes?",
    answer: "Update and confirm your role or tasks. Future results use your new profile, and findings based on your old profile are marked for refresh.",
  },
  {
    question: "Do I have to change careers?",
    answer: "No. Improving your current work is a complete path. Exploring other roles is optional, and learning a skill does not guarantee a job offer or a higher salary.",
  },
];

const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="section home-faq" id="faq" aria-labelledby="home-faq-title">
      <div className="container home-faq-grid">
        <ScrollReveal className="home-reveal" threshold={0.12}>
          <div>
            <div className="home-eyebrow">A few things to know</div>
            <h2 id="home-faq-title">Start with confidence.</h2>
          </div>
        </ScrollReveal>
        <ScrollReveal className="home-reveal" threshold={0.12} delay={120}>
          <div className="home-faq-list">
            {FAQS.map((item, index) => {
              const open = openIndex === index;
              return (
                <div key={item.question} className={`home-faq-item${open ? " is-open" : ""}`}>
                  <h3>
                    <button
                      type="button"
                      id={`home-faq-q-${index}`}
                      aria-expanded={open}
                      aria-controls={`home-faq-a-${index}`}
                      onClick={() => setOpenIndex(open ? null : index)}
                    >
                      <span>{item.question}</span>
                      <span className="home-faq-icon" aria-hidden="true" />
                    </button>
                  </h3>
                  <div
                    className="home-faq-answer"
                    id={`home-faq-a-${index}`}
                    role="region"
                    aria-labelledby={`home-faq-q-${index}`}
                    inert={!open}
                  >
                    <div>
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FaqSection;
