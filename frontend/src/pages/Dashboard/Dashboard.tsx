import { ArrowRight, Bot, BriefcaseBusiness, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/common/PageHeader";
import { ROUTES } from "@/constants/routes";

const steps = [
  {
    epic: "E1",
    title: "Describe your real work",
    description: "Choose an occupation and confirm the tasks that actually belong to your role.",
    icon: BriefcaseBusiness,
  },
  {
    epic: "E2",
    title: "Understand task change",
    description: "See which activities may be supported, transformed, or remain strongly human-led.",
    icon: Bot,
  },
  {
    epic: "E3",
    title: "Recognise your capabilities",
    description: "Connect changing tasks to the transferable strengths you already use every day.",
    icon: ShieldCheck,
  },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your work is changing. Your value is evolving with it."
        description="Build an evidence-based view of your role, understand where AI may help, and choose practical next steps."
      />

      <section className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-8 text-background shadow-xl md:px-10 md:py-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/35 blur-3xl" />
        <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid items-end gap-8 lg:grid-cols-[1fr_340px]">
          <div className="max-w-2xl">
            <Badge className="mb-5 bg-background/10 text-background hover:bg-background/15">
              AI-Wrevolusi · Guided career reflection
            </Badge>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              Start with what you do,
              <span className="block text-accent">not what AI might replace.</span>
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-background/70 md:text-base">
              Map your real tasks against trusted occupational evidence, then turn uncertainty into a focused development plan.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl bg-background text-foreground hover:bg-background/90">
                <Link to={ROUTES.workProfile}>
                  Build my work profile <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background">
                <Link to={ROUTES.aiExposure}>Explore AI exposure</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-background/15 bg-background/10 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-accent/20 p-2.5 text-accent">
                <ChartNoAxesCombined className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Your journey</p>
                <p className="text-xs text-background/55">Evidence before recommendations</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {["Confirm occupation", "Review real tasks", "Interpret AI exposure"].map((label, index) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/10 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-background/80">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">How it works</p>
            <h2 className="mt-1 text-2xl font-semibold">A clearer path through uncertainty</h2>
          </div>
          <p className="hidden max-w-md text-right text-sm text-muted-foreground md:block">
            Every recommendation stays traceable to the tasks and evidence you confirm.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.epic} className="group border-primary/10 shadow-sm transition hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold tracking-widest text-muted-foreground">{step.epic}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
