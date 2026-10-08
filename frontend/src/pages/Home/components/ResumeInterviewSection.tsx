import { ArrowRight, Check, FileText, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import ScrollReveal from "@/components/ui/scroll-reveal";
import "./resume-interview.css";

export default function ResumeInterviewSection() {
  return (
    <section className="home-career-ready" aria-labelledby="home-career-ready-title">
      <div className="container">
        <ScrollReveal className="home-reveal" threshold={0.12}>
        <header className="home-career-ready-heading">
          <div className="home-eyebrow">Your next opportunity</div>
          <h2 id="home-career-ready-title">Resume &amp; Interview</h2>
          <p>Prepare your resume and practise how you present your experience.</p>
        </header>
        </ScrollReveal>
        <div className="home-career-ready-grid">
          <ScrollReveal className="home-reveal home-career-ready-reveal" threshold={0.15}>
          <article className="home-career-ready-card">
            <div className="home-career-ready-preview home-career-ready-resume">
              <span className="home-career-ready-example">Example preview · fictional details</span>
              <div className="home-career-ready-paper" aria-label="Example resume for Maya Tan">
                <div className="home-career-ready-paper-heading"><strong>Maya Tan</strong><span>Data Analyst</span></div>
                <div className="home-career-ready-paper-section"><h4>Profile</h4><p>Experience preparing reports, checking data and communicating findings clearly.</p></div>
                <div className="home-career-ready-paper-section"><h4>Experience</h4><strong>Reporting Assistant</strong><p>Reviewed weekly reports and worked with colleagues to resolve data inconsistencies.</p><div className="home-career-ready-lines" aria-hidden="true"><i /><i /></div></div>
                <div className="home-career-ready-paper-section"><h4>Skills</h4><p>Excel · Data quality · Communication</p></div>
              </div>
              <span className="home-career-ready-paper-note"><Check size={14} aria-hidden="true" /> Shaped around your target job</span>
            </div>
            <div className="home-career-ready-copy">
              <h3><FileText size={20} aria-hidden="true" /> Your experience, clearly presented.</h3>
              <p>Bring your resume or start with your skills and experience. Create a draft you can review and make your own.</p>
              <Link to={ROUTES.resumeBuilder}>Build my resume <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
          </article>
          </ScrollReveal>
          <ScrollReveal className="home-reveal home-career-ready-reveal" threshold={0.15} delay={140}>
          <article className="home-career-ready-card">
            <div className="home-career-ready-preview home-career-ready-interview">
              <span className="home-career-ready-example">Example preview</span>
              <div className="home-career-ready-conversation">
                <div className="home-career-ready-question"><span>Interview question</span><p>Tell me about a time you solved a problem at work.</p></div>
                <div className="home-career-ready-answer"><span>Your answer</span><p>I noticed errors in our weekly report and checked the source data with my colleagues…</p></div>
                <div className="home-career-ready-feedback"><Check size={18} aria-hidden="true" /><div><span>A clearer answer</span><p>Explain what you changed and how you checked the result.</p></div></div>
              </div>
            </div>
            <div className="home-career-ready-copy">
              <h3><MessageSquare size={20} aria-hidden="true" /> Tell the story behind your skills.</h3>
              <p>Practise questions for your target role and get feedback to explain your experience more clearly.</p>
              <div className="home-career-ready-soon">Interview practice <span>Coming soon</span></div>
            </div>
          </article>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
