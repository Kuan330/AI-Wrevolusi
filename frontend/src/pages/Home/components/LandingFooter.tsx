import Logo from "@/components/common/Logo";
import { FOOTER_COLUMNS, FOOTER_CONTACT } from "./homeData";

const LandingFooter = () => {
  return (
    <footer className="landing-footer">
      <div className="footer-strip">
        <div className="container footer-main">
          <div className="footer-brand">
            <Logo imageClassName="h-14" />
            <p>{FOOTER_CONTACT.note}</p>
            <div className="footer-team-badge">
              {FOOTER_CONTACT.teamMeta} - {FOOTER_CONTACT.teamName}
            </div>
          </div>

          <div className="footer-columns">
            {FOOTER_COLUMNS.map((group) => (
              <div key={group.title} className="footer-column">
                <h4>{group.title}</h4>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <span className="footer-text-only">{link.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="container">
          <div className="footer-bottom-line">
            <span>(c) 2026 {FOOTER_CONTACT.projectName}</span>
            <span>{FOOTER_CONTACT.teamMeta}</span>
            <span>Team name: {FOOTER_CONTACT.teamName}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
