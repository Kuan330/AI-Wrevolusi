import MobileMenu from "@/components/layout/MobileMenu";
import Logo from "@/components/common/Logo";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

const Navbar = () => {
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/70 backdrop-blur-xl"
      style={{ background: PAGE_GRADIENT_CSS }}
    >
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <MobileMenu />
          <Logo showWordmark />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
