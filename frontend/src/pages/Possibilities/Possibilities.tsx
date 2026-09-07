import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { AppButton } from "@/components/ui/app-button";
import { Button } from "@/components/ui/button";
import JourneyIntro from "@/components/account/JourneyIntro";
import {
  readConfirmedAnalysis,
  readTaskWorkspace,
} from "@/pages/WorkProfile/userProfile";
import { readLearningCentreItems } from "@/pages/Skills/skillDirections";
import { accountStorage } from "@/services/accountStorage";
import { ROUTES } from "@/constants/routes";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";
import PossibilitiesDemo from "./PossibilitiesDemo";
const options = [
  {
    id: "grow",
    title: "Grow in my current role",
    description:
      "Build on your experience and explore a skill you can use in your current work.",
    steps: [
      "Choose one recurring task you want to improve.",
      "Review its related skills and pick a learning theme.",
      "Try what you learn on a small task and record the result.",
    ],
  },
  {
    id: "related",
    title: "Explore related roles",
    description:
      "Identify transferable skills and investigate roles where they could be useful.",
    steps: [
      "Review the skills reflected in your confirmed tasks.",
      "Choose a related role that interests you and read its actual requirements.",
      "Compare those requirements with your experience and choose one skill to develop.",
    ],
  },
  {
    id: "new",
    title: "Consider a new direction",
    description:
      "Start with your interests and gather evidence before deciding on a change.",
    steps: [
      "Write down the kind of work you would like to explore.",
      "Look at real role descriptions and note the experience or qualifications they require.",
      "Choose a small learning activity to test your interest.",
    ],
  },
];
const key = "aiwrevolusi.possibilities.intent";
export default function Possibilities() {
  const [params] = useSearchParams();
  const [intent, setIntent] = useState(() => {
    try {
      return JSON.parse(accountStorage.getItem(key) ?? "null") as string | null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState("");
  if (
    params.get("example") === "1" ||
    (import.meta.env.DEV && params.get("demo") === "1")
  )
    return (
      <>
        <div className="mx-auto mb-4 max-w-[1180px]">
          <Button variant="link" asChild>
            <Link to={ROUTES.possibilities}>← Back to my direction</Link>
          </Button>
        </div>
        <PossibilitiesDemo />
      </>
    );
  const analysis = readConfirmedAnalysis();
  if (!analysis)
    return (
      <JourneyIntro kind="possibilities">
        <AppButton tone="gradient" asChild>
          <Link
            to={
              readTaskWorkspace()?.tasksOccupationCode
                ? ROUTES.task
                : ROUTES.workProfile
            }
          >
            {readTaskWorkspace()?.tasksOccupationCode
              ? "Analyse your updated tasks"
              : "Build your work profile"}
            <ArrowRight className="size-4" />
          </Link>
        </AppButton>
      </JourneyIntro>
    );
  const chosen = options.find((option) => option.id === intent);
  const themes = readLearningCentreItems();
  return (
    <div className="mx-auto max-w-[1180px] pb-10">
      <PageHeader
        title="Explore your possibilities"
        description={`Start with your experience in ${analysis.occupationTitle}. Choose what you would like to explore next.`}
      />
      <Card className="rounded-3xl border-white/80 bg-white/80">
        <CardContent className="p-6 sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#4f91ba]">
            Choose your direction
          </p>
          <h2 className="text-2xl font-semibold">
            What would you like to explore?
          </h2>
          <p className="mt-2 text-sm text-[#7f7280]">
            You can change this at any time. These are exploration steps, not a
            job suitability assessment.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {options.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                aria-pressed={intent === option.id}
                className="h-auto min-w-0 flex-col items-start whitespace-normal rounded-2xl p-5 text-left"
                style={
                  intent === option.id
                    ? { background: PAGE_GRADIENT_CSS, borderColor: "#4f91ba" }
                    : undefined
                }
                onClick={() => {
                  try {
                    accountStorage.setItem(key, JSON.stringify(option.id));
                    setIntent(option.id);
                    setError("");
                  } catch {
                    setError(
                      "Could not save your direction. Please try again.",
                    );
                  }
                }}
              >
                <span className="font-semibold">
                  {option.title}
                  {intent === option.id && (
                    <Check className="ml-2 inline size-4" />
                  )}
                </span>
                <span className="mt-3 text-sm font-normal leading-6 text-[#7f7280]">
                  {option.description}
                </span>
              </Button>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
        </CardContent>
      </Card>
      {chosen && (
        <Card className="mt-6 rounded-3xl border-white/80 bg-white/80">
          <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4f91ba]">
                Your saved intention
              </p>
              <h2 className="mt-3 text-2xl font-semibold">{chosen.title}</h2>
              <ol className="mt-5 space-y-4">
                {chosen.steps.map((step, index) => (
                  <li className="flex gap-3 text-sm leading-6" key={step}>
                    <span className="text-[#4f91ba]">0{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
            <section
              className="rounded-2xl p-5"
              style={{ background: PAGE_GRADIENT_CSS }}
            >
              <h3 className="font-semibold">A learning step you can choose</h3>
              <p className="mt-3 text-sm leading-6 text-[#7f7280]">
                {themes.length
                  ? `You have ${themes.length} saved learning themes. Revisit them and decide which supports this direction.`
                  : "Review your skill map and choose a learning theme that supports your intention."}
              </p>
              <AppButton tone="gradient" asChild className="mt-5">
                <Link
                  to={themes.length ? ROUTES.learningCentre : ROUTES.skills}
                >
                  {themes.length ? "Explore my resources" : "Review my skills"}
                  <ArrowRight className="size-4" />
                </Link>
              </AppButton>
              <p className="mt-4 text-xs leading-5 text-[#7f7280]">
                Want to see how role connections could look? This preview uses
                an illustrative profile.
              </p>
              <Button
                variant="link"
                asChild
                className="mt-1 h-auto whitespace-normal p-0 text-left"
              >
                <Link to={`${ROUTES.possibilities}?example=1`}>
                  View example career connections →
                </Link>
              </Button>
            </section>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
