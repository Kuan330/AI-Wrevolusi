import { Link } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

type LogoProps = {
  to?: string;
  showWordmark?: boolean;
  className?: string;
};

const Logo = ({ to = ROUTES.home, showWordmark = true, className }: LogoProps) => {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#C7958B] to-[#4F91BA]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2C7 2 3 7 3 12s5 10 10 10 10-5 10-10S17 2 12 2z" />
          <path d="M12 6v6l4 2" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-[18px] font-semibold tracking-tight text-[#3D2B36]">AI-Wrevolusi</span>
      ) : (
        <span className="text-sm font-semibold text-primary">Iteration 1</span>
      )}
    </Link>
  );
};

export default Logo;
