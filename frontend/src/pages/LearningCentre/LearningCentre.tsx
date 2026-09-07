import { useState } from "react";
import { ArrowLeft, BookOpen, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import {
  readLearningCentreItems,
  removeLearningCentreItem,
} from "@/pages/Skills/skillDirections";
import "@/pages/Skills/skills.css";

const LearningCentre = () => {
  const [items, setItems] = useState(readLearningCentreItems);

  return (
    <div className="skills-page learning-centre-page mx-auto w-full max-w-[1180px] space-y-6 pb-10">
      <PageHeader
        title="Learning Centre"
        description="Your chosen learning themes are collected here before they are matched with specific courses and resources."
        actions={
          <Button asChild variant="outline" className="profile-outline-btn rounded-full">
            <Link to={ROUTES.skills}>
              <ArrowLeft aria-hidden />
              Back to skills
            </Link>
          </Button>
        }
      />

      <section className="skills-glass-card p-6 lg:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="skills-kicker">Your learning plan</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#2f2430]">
              Topics ready for course matching
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7f7280]">
              These topics came from the skill directions you confirmed. Course matching is
              the next stage and should use a verified course catalogue rather than invented links.
            </p>
          </div>
          <div className="learning-centre-count">
            <strong>{items.length}</strong>
            <span>saved topics</span>
          </div>
        </div>

        {items.length ? (
          <div className="learning-centre-grid">
            {items.map((item) => (
              <article key={item.theme_id} className="learning-centre-topic">
                <div className="learning-centre-topic__heading">
                  <span><BookOpen aria-hidden /></span>
                  <small>{item.skill_name}</small>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => setItems(removeLearningCentreItem(item.theme_id))}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="learning-centre-topic__status">
                  <Search aria-hidden />
                  Ready for verified course matching
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="learning-centre-empty">
            <BookOpen aria-hidden />
            <h3>No learning topics saved yet</h3>
            <p>Confirm your skill directions, then choose the themes you want to explore.</p>
            <Button asChild className="profile-gradient-btn rounded-full font-normal">
              <Link to={ROUTES.skills}>Choose skill directions</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};

export default LearningCentre;
