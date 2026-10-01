import type { ComponentProps } from "react";
import { useAccount } from "@/components/account/useAccount";
import { Link } from "react-router-dom";

import { ROUTES } from "@/constants/routes";

const CtaSection = () => {
  const { user } = useAccount();
  const linkProps1 = {
    to: user ? ROUTES.aiExposure : ROUTES.workProfile,
    state: user ? undefined : { authMode: "register" },
    className: "btn btn-warm",
  } satisfies Partial<ComponentProps<typeof Link>>;
  return (
    <section className="section" style={{ paddingBottom: 20 }}>
      <div className="container">
        <div className="cta-bottom">
          <h2>See the change - and the choices still yours.</h2>
          <p>A free account keeps your work review and learning choices together.</p>
          <Link {...linkProps1}>{user ? "Continue my work review" : "Create a free account"}</Link>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
