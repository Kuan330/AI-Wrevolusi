import { NavLink, useLocation } from "react-router-dom";

import { SIDEBAR_MENU } from "@/constants/menu";
import { ROUTES } from "@/constants/routes";

const itemIsActive = (path: string, pathname: string, hash: string) => {
  const [base, itemHash] = path.split("#");
  if (itemHash) {
    return pathname === base && hash === `#${itemHash}`;
  }
  if (path === ROUTES.dashboard) {
    return pathname === ROUTES.dashboard && hash === "";
  }
  return pathname === path;
};

const Sidebar = () => {
  const { pathname, hash } = useLocation();

  return (
    <aside className="hidden h-full w-72 shrink-0 border-r border-border bg-card p-4 lg:block">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Iteration Flow
      </p>
      <nav className="space-y-2">
        {SIDEBAR_MENU.map((item) => {
          const active = itemIsActive(item.path, pathname, hash);
          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={`block rounded-lg border p-3 text-sm transition ${
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.epic}</p>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
