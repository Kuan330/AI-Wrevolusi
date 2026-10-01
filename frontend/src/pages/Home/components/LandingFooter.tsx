import Logo from "@/components/common/Logo";
import { FOOTER_CONTACT } from "./homeData";

const LandingFooter = () => {
  return (
    <footer className="landing-footer">
      <div className="container home-footer-row">
        <Logo />
        <span>For working women in Malaysia.</span>
        <span>{FOOTER_CONTACT.teamMeta} · {FOOTER_CONTACT.teamName}</span>
        <span>© 2026 {FOOTER_CONTACT.projectName}</span>
      </div>
    </footer>
  );
};

export default LandingFooter;
