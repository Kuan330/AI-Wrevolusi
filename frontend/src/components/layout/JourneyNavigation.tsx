import { Link, useLocation } from "react-router-dom";
import { useAccount } from "@/components/account/useAccount";
import {
  getJourneyArea,
  getWorkStepStatus,
  LEARNING_NAV_MENU,
  WORK_NAV_MENU,
} from "@/constants/menu";
import { ROUTES } from "@/constants/routes";
import type { UserProfile } from "@/features/work-profile/userProfile";
import { isSkillReviewCurrent, readJourneyProfile } from "@/features/journey/journey";
import "./journeyNavigation.css";

export default function JourneyNavigation() {
  // Subscribe to the account context so workspace changes refresh saved status.
  useAccount();
  const location = useLocation();
  const area = getJourneyArea(location.pathname);
  let profile: UserProfile | null = null;
  let skillsReviewed = false;
  let readError = "";
  try {
    profile = readJourneyProfile();
    skillsReviewed = isSkillReviewCurrent();
  } catch (error) {
    readError = error instanceof Error ? error.message : "Your saved journey status could not be read.";
  }
  const workConfirmed = Boolean(profile?.tasksConfirmed || profile?.analysis?.tasks.length);
  const status = {
    workConfirmed,
    assessmentChecked: Boolean(profile?.analysis),
    skillsReviewed,
  };

  if (area !== "work" && area !== "learning") return null;
  const items = area === "work"
    ? WORK_NAV_MENU.map((item) => ({ ...item, savedStatus: getWorkStepStatus(item.key, status) }))
    : LEARNING_NAV_MENU.map((item) => ({ ...item, savedStatus: undefined }));

  return (
    <div className="journey-navigation">
      <nav aria-label={area === "work" ? "My Work pages" : "My Learning pages"}>
        <ul className={`journey-navigation__items journey-navigation__items--${area}`}>
          {items.map((item) => {
            const current = location.pathname === item.path || (item.path === ROUTES.workProfile && location.pathname.startsWith(`${ROUTES.workProfile}/`));
            const { savedStatus } = item;
            return (
              <li key={item.key}>
                <Link
                  to={item.path}
                  state={
                    item.path === ROUTES.workProfile && !current
                      ? { returnTo: location.pathname + location.search }
                      : undefined
                  }
                  aria-current={current ? "page" : undefined}
                  className="journey-navigation__link"
                >
                  <span className="journey-navigation__text">
                    <span>{item.label}</span>
                    {savedStatus && (
                      <span className="journey-navigation__status">{savedStatus}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {readError && (
        <p className="journey-navigation__hint" role="status">
          {readError}{" "}
          <Link to={ROUTES.continue}>Review your saved journey</Link>.
        </p>
      )}
      {area === "work" && !workConfirmed && !readError && (
        <p className="journey-navigation__hint">
          AI findings and skill suggestions use your confirmed work.{" "}
          <Link to={ROUTES.workProfile}>
            Review and confirm your profile
          </Link>
          .
        </p>
      )}
    </div>
  );
}
