import { Link } from "react-router-dom";
import { ArrowUpRight, Sprout } from "lucide-react";
import { ROUTES } from "@/constants/routes";

type Props = { name?: string; completedChapters?: number; totalChapters?: number; practiceCount?: number };
export default function SkillProgressCard({ name, completedChapters, totalChapters, practiceCount }: Props) {
  return <aside className="growth-skill-card" aria-label="Skill you are building">
    <p className="dashboard-eyebrow">SKILL YOU’RE BUILDING</p>
    <span className="growth-skill-icon" aria-hidden="true"><Sprout size={28} /></span>
    <h3>{name || "Find your next strength"}</h3>
    <p>{name ? "Build this skill through learning and everyday practice." : "Explore skills connected to your work and choose where to grow next."}</p>
    {name && <span className="growth-skill-status">{totalChapters ? `${completedChapters} / ${totalChapters} course chapters complete` : practiceCount ? `${practiceCount} practice & study records` : "Ready to begin"}</span>}
    <Link className="dashboard-text-link" to={ROUTES.skills}>{name ? "View skill path" : "Choose a skill"}<ArrowUpRight size={16} /></Link>
  </aside>;
}
