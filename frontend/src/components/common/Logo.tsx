import { Link } from "react-router-dom";

const Logo = () => {
  return (
    <Link to="/" className="inline-flex items-center gap-2">
      <img src="/images/logo.svg" alt="AI-Wrevolusi" className="h-7 w-auto" />
      <span className="text-sm font-semibold text-primary">Iteration 1</span>
    </Link>
  );
};

export default Logo;
