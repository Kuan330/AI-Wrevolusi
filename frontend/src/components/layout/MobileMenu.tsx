import { MenuIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

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

const MobileMenu = () => {
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
              end={item.path === ROUTES.dashboard || item.path === ROUTES.workProfile}
              className="block rounded-md border border-border p-3 text-sm hover:bg-muted"
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
