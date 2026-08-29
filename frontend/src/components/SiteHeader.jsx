import { NavLink, useLocation } from "react-router-dom";
import { STEPS } from "../constants";

export function SiteHeader() {
  const { pathname } = useLocation();
  const idx = STEPS.findIndex((s) => s.path === pathname);

  return (
    <header className="site-header">
      <div className="inner">
        <p className="logo">AI-Wrevolusi</p>
        <nav className="steps" aria-label="Progress">
          {STEPS.map((step, i) => (
            <NavLink
              key={step.id}
              to={step.path}
              end={step.path === "/"}
              className={({ isActive }) => [isActive ? "active" : "", i < idx ? "done" : ""].join(" ")}
            >
              {step.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
