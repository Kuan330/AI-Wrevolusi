import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TitleTone = {
  background: string;
  color: string;
};

type AnalysisCardProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  headerContent?: ReactNode;
  titleTone?: TitleTone | null;
  contentClassName?: string;
};

const AnalysisCard = ({
  eyebrow,
  title,
  description,
  action,
  headerContent,
  titleTone,
  className,
  contentClassName,
  children,
  ...props
}: AnalysisCardProps) => {
  return (
    <Card
      className={cn(
        "analysis-card analysis-card--layout",
        className,
      )}
      {...props}
    >
      {eyebrow || title || description || action ? (
        <CardHeader className="analysis-card__header">
          {eyebrow ? (
            <p className="analysis-card__eyebrow">
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
          {headerContent ? <div className="pt-2">{headerContent}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          "analysis-card__content",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
};

export default AnalysisCard;
