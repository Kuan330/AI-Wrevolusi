import type { ComponentProps } from "react";
import {
  hasConfirmedAnalysis,
  readTaskWorkspace,
} from "@/pages/WorkProfile/userProfile";
import { readLearningCentreItems } from "@/pages/Skills/skillDirections";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { AppButton } from "@/components/ui/app-button";
import { useAccount } from "./useAccount";
import { AuthDialog } from "./AuthDialog";
import { ROUTES } from "@/constants/routes";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";

export type JourneyKind = "resources" | "plan" | "possibilities";
const content = {
  resources: {
    name: "Learning Resources",
    title: "Turn a skill into your next learning step",
    description:
      "Choose a learning theme on the Skills page to explore relevant resources and build your own plan.",
    steps: [
      [
        "Choose a skill",
        "Find a skill you want to develop and save a learning theme.",
      ],
      [
        "Explore resources",
        "Compare relevant content and choose what fits your goal.",
      ],
      ["Save your next step", "Keep a shortlist and bring it into My Plan."],
    ],
    action: "Choose a skill",
    path: ROUTES.skills,
  },
  plan: {
    name: "My Plan",
    title: "Make room for your next step",
    description:
      "Bring a resource into your week and arrange learning alongside work and everyday life.",
    steps: [
      ["Choose a resource", "Start with something you want to learn."],
      ["Make a little time", "Arrange a session that fits your schedule."],
      [
        "Track your progress",
        "Mark activities complete and adjust your next step.",
      ],
    ],
    action: "Explore learning resources",
    path: ROUTES.learningCentre,
  },
  possibilities: {
    name: "Possibilities",
    title: "Explore where your skills could take you",
    description:
      "Use your work experience and learning interests to consider your next direction.",
    steps: [
      ["Know your starting point", "Review the skills reflected in your work."],
      [
        "Choose a direction",
        "Grow in your role or explore something different.",
      ],
      ["Take a small step", "Save an intention and choose a skill to explore."],
    ],
    action: "Build your work profile",
    path: ROUTES.workProfile,
  },
};
export default function JourneyIntro(props: {
  kind: JourneyKind;
  children?: ReactNode;
}) {
  const { kind, children } = props;
  const data = content[kind];
  const { user, error } = useAccount();
  let action = data.action;
  let path: string = data.path;
  if (
    user &&
    (kind === "resources" ||
      (kind === "plan" && !readLearningCentreItems().length))
  ) {
    if (!hasConfirmedAnalysis()) {
      const hasTasks = Boolean(readTaskWorkspace()?.tasksOccupationCode);
      action = hasTasks ? "Analyse your tasks" : "Build your work profile";
      path = hasTasks ? ROUTES.task : ROUTES.workProfile;
    } else if (kind === "plan") {
      action = "Choose a skill";
      path = ROUTES.skills;
    }
  }
  const [authOpen, setAuthOpen] = useState(false);
  const pageHeaderProps1 = {
    title: data.name,
    description: "Your next step, at your own pace.",
  } satisfies Partial<ComponentProps<typeof PageHeader>>;
  const cardContentProps2 = {
    className: "grid gap-8 p-6 sm:p-10 lg:grid-cols-2",
    style: { background: PAGE_GRADIENT_CSS },
  } satisfies Partial<ComponentProps<typeof CardContent>>;
  return (
    <div className="mx-auto w-full max-w-[1180px] pb-10">
      <PageHeader {...pageHeaderProps1} />
      <Card className="overflow-hidden rounded-3xl border-white/80 bg-white/80 shadow-xl">
        <CardContent {...cardContentProps2}>
          <section className="self-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#4f91ba]">
              {user ? "Ready when you are" : "Your personal learning space"}
            </p>
            <h2 className="text-3xl font-semibold leading-tight text-[#2f2430]">
              {data.title}
            </h2>
            <p className="mt-5 text-sm leading-7 text-[#7f7280]">
              {data.description}
            </p>
            <div className="mt-6">
              {!user ? (
                <>
                  <AppButton
                    {...({
                      tone: "gradient",
                      onClick: () => setAuthOpen(true),
                    } satisfies Partial<ComponentProps<typeof AppButton>>)}
                  >
                    Log in / Create account <ArrowRight className="size-4" />
                  </AppButton>
                  <p className="mt-3 text-xs text-[#7f7280]">
                    Save your choices and return to them later. No email
                    required.
                  </p>
                </>
              ) : (
                (children ?? (
                  <AppButton
                    {...({ tone: "gradient", asChild: true } satisfies Partial<
                      ComponentProps<typeof AppButton>
                    >)}
                  >
                    <Link
                      to={
                        path === ROUTES.skills
                          ? `${path}#skill-directions`
                          : path
                      }
                    >
                      {action}
                      <ArrowRight className="size-4" />
                    </Link>
                  </AppButton>
                ))
              )}
            </div>
            {!user && error && (
              <p className="mt-4 text-xs text-[#7f7280]" role="status">
                {error}
              </p>
            )}
          </section>
          <ol className="space-y-3">
            {data.steps.map(([title, description], index) => (
              <li
                key={title}
                className="flex gap-4 rounded-2xl border border-white bg-white/70 p-5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eaf3fb] text-sm font-semibold text-[#4f91ba]">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-[#3d5f7a]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#7f7280]">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {authOpen && (
        <AuthDialog
          {...({
            open: true,
            onClose: () => setAuthOpen(false),
            destination: window.location.pathname,
          } satisfies Partial<ComponentProps<typeof AuthDialog>>)}
        />
      )}
    </div>
  );
}
