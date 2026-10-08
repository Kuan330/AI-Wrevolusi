import { useRef, useState } from "react";
import DeveloperModelsDialog from "@/components/common/DeveloperModelsDialog";
import Logo from "@/components/common/Logo";
import { FOOTER_CONTACT } from "./homeData";

const LandingFooter = () => {
  const trigger = useRef<HTMLButtonElement>(null);
  const clicks = useRef({ count: 0, at: 0 });
  const [developerOpen, setDeveloperOpen] = useState(false);
  const openChange = (open: boolean) => { clicks.current = { count: 0, at: 0 }; setDeveloperOpen(open); };
  return (
    <footer className="landing-footer">
      <div className="container home-footer-row">
        <Logo />
        <span>For working women in Malaysia.</span>
        <span>{FOOTER_CONTACT.teamMeta} · {FOOTER_CONTACT.teamName}</span>
        <button ref={trigger} type="button" className="home-developer-trigger" onClick={() => {
          const now = Date.now();
          clicks.current = { count: now - clicks.current.at <= 2000 ? clicks.current.count + 1 : 1, at: now };
          if (clicks.current.count === 10) openChange(true);
        }}>© 2026 {FOOTER_CONTACT.projectName}</button>
        <DeveloperModelsDialog open={developerOpen} onOpenChange={openChange} restoreFocus={() => trigger.current?.focus()} />
      </div>
    </footer>
  );
};

export default LandingFooter;
