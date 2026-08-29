import { MenuIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const MobileMenu = () => {
  const { pathname, hash } = useLocation();

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
          <MenuIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Navigation</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SIDEBAR_MENU.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              className={`block rounded-md border border-border p-3 text-sm hover:bg-muted ${
                itemIsActive(item.path, pathname, hash) ? "border-primary/30 bg-primary/10" : ""
              }`}
            >
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </NavLink>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MobileMenu;
