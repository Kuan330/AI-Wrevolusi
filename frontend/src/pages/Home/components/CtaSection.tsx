import { useAccount } from "@/components/account/useAccount";
import { Link } from "react-router-dom";

import { ROUTES } from "@/constants/routes";

const CtaSection = () => {
  const { user } = useAccount();
  return (
    <section className="section" style={{ paddingBottom: 20 }}>
      <div className="container">
        <div className="cta-bottom">
          <h2>See the change - and the choices still yours.</h2>
          <p>About 5 minutes - Free personal overview</p>
          <Link to={user ? ROUTES.aiExposure : ROUTES.workProfile} className="btn btn-warm">
            Start free analysis
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
