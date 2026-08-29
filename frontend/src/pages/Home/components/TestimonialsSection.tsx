import SectionHeader from "@/components/ui/section-header";
import { TESTIMONIALS } from "./homeData";

const TestimonialsSection = () => {
  return (
    <section className="section">
      <div className="container">
        <SectionHeader
          title="What they said"
          subtitle="Illustrative voices from women thinking through AI at work."
        />
        <div className="testimonials-grid">
          {TESTIMONIALS.map((item) => (
            <div key={item.quote} className="testimonial-card glass">
              <div className="testimonial-header">
                <div className="testimonial-avatar">{item.avatar}</div>
                <div className="testimonial-meta">
                  <div className="name">{item.name}</div>
                  <div className="role">{item.role}</div>
                </div>
              </div>
              <blockquote>"{item.quote}"</blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
