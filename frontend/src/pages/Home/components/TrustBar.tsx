import CheckIcon from "@/components/ui/check-icon";
import { TRUST_ITEMS } from "./homeData";

const TrustBar = () => {
  return (
    <div className="container">
      <div className="trust-bar">
        {TRUST_ITEMS.map((item) => (
          <div key={item} className="trust-item">
            <CheckIcon />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustBar;
