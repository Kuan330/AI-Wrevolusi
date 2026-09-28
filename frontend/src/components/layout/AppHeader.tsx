import { Link, useLocation } from "react-router-dom";
import AccountMenu from "@/components/account/AccountMenu";
import Logo from "@/components/common/Logo";
import { getJourneyArea, PRIMARY_NAV_MENU } from "@/constants/menu";
import { ROUTES } from "@/constants/routes";
import "./journeyNavigation.css";

const AppHeader = () => {
  const location = useLocation();
  const activeArea = getJourneyArea(location.pathname);

  return (
    <header className="journey-header">
      <div className="journey-header__inner">
        <div className="journey-header__brand">
          <Logo showWordmark />
        </div>
        <nav className="journey-header__areas" aria-label="Main areas">
          {PRIMARY_NAV_MENU.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              state={
                item.path === ROUTES.workProfile && location.pathname !== ROUTES.workProfile
                  ? { returnTo: location.pathname + location.search }
                  : undefined
              }
              aria-current={activeArea === item.key ? "true" : undefined}
              className="journey-header__area"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="journey-header__account">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
