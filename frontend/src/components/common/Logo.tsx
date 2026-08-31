import { Link } from "react-router-dom";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

type LogoProps = {
  to?: string;
  showWordmark?: boolean;
  className?: string;
  imageClassName?: string;
};

const LOGO_MARK_SRC = "/images/logo-mark.svg";

const Logo = ({
  to = ROUTES.home,
  showWordmark = true,
  className,
  imageClassName,
}: LogoProps) => {
  return (
    <Link
      to={to}
      aria-label="AI-Wrevolusi home"
      className={cn("inline-flex shrink-0 items-center gap-2.5", className)}
    >
      <img
        src={LOGO_MARK_SRC}
        alt={showWordmark ? "" : "AI-Wrevolusi"}
        aria-hidden={showWordmark}
        className={cn("h-9 w-auto object-contain", imageClassName)}
      />
      {showWordmark ? (
        <span className="text-[18px] font-semibold tracking-tight text-[#3D2B36]">AI-Wrevolusi</span>
      ) : null}
    </Link>
  );
};

export default Logo;
