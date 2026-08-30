import { Link } from "react-router-dom";
import { User } from "lucide-react";

import Logo from "@/components/common/Logo";
import { PAGE_GRADIENT_CSS, Palette } from "@/pages/Dashboard/lib/palette";
import { ROUTES } from "@/constants/routes";

const AppHeader = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/45 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Logo showWordmark />
          <nav aria-label="Primary">
            <Link
              to={ROUTES.home}
              className="inline-flex h-9 items-center rounded-full px-4 text-[15px] font-bold"
              style={{ background: PAGE_GRADIENT_CSS, color: Palette.Blue }}
            >
              Home
            </Link>
          </nav>
        </div>

        <button
          type="button"
          aria-label="Account"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/70 text-[#7f7280]"
        >
          <User className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
