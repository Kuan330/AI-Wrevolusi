import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-white/70 pb-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="m-0 flex min-h-10 items-center text-2xl font-semibold leading-[1.2] text-[#2f2430]">
          {title}
        </h1>
        {description ? <div className="mt-1 text-sm text-[#7f7280]">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
};

export default PageHeader;
