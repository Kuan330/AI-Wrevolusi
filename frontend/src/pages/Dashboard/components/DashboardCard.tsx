import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TitleTone = {
  background: string;
  color: string;
};

type DashboardCardProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  titleTone?: TitleTone | null;
  contentClassName?: string;
};

const DashboardCard = ({
  eyebrow,
  title,
  description,
  action,
  titleTone,
  className,
  contentClassName,
  children,
  ...props
}: DashboardCardProps) => {
  return (
    <Card
      className={cn(
        "dashboard-card flex min-h-0 flex-col overflow-hidden border-white/80 bg-white/75 shadow-[0_14px_34px_rgba(61,43,54,0.1)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {eyebrow || title || description || action ? (
        <CardHeader className="shrink-0 space-y-1 p-4 pb-2">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7f7280]">
              {eyebrow}
            </p>
          ) : null}
          {title || action ? (
            <div className="flex items-start justify-between gap-2">
              {title ? (
                <CardTitle
                  className={cn(
                    "text-base font-semibold leading-snug",
                    titleTone ? "w-fit rounded-md px-2 py-0.5" : "text-[#2f2430]",
                  )}
                  style={
                    titleTone
                      ? { background: titleTone.background, color: titleTone.color }
                      : undefined
                  }
                >
                  {title}
                </CardTitle>
              ) : (
                <span />
              )}
              {action}
            </div>
          ) : null}
          {description ? (
            <CardDescription className="text-xs leading-5 text-[#7f7280]">
              {description}
            </CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("flex min-h-0 flex-1 flex-col p-4 pt-2", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};

export default DashboardCard;
