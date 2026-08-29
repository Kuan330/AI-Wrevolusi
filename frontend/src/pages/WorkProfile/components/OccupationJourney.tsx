import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Check, Database, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { referenceService } from "@/services/referenceService";
import type { ReferenceOccupation, ReferenceTask } from "@/types/reference";

const OccupationJourney = () => {
  const [options, setOptions] = useState<ReferenceOccupation[]>([]);
  const [path, setPath] = useState<ReferenceOccupation[]>([]);
  const [tasks, setTasks] = useState<ReferenceTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedOccupation = path.at(-1) ?? null;

  const loadOccupations = async (parent?: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await referenceService.occupations(parent);
      setOptions(rows);
      return rows;
    } catch {
      setError("Unable to read occupations from the shared Neon database.");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void referenceService
      .occupations()
      .then((rows) => {
        if (active) setOptions(rows);
      })
      .catch(() => {
        if (active) setError("Unable to read occupations from the shared Neon database.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const chooseOccupation = async (occupation: ReferenceOccupation) => {
    const existingIndex = path.findIndex(
      (item) => item.occupation_code === occupation.occupation_code,
    );
    const nextPath =
      existingIndex >= 0 ? path.slice(0, existingIndex + 1) : [...path, occupation];
    setPath(nextPath);
    setTasks([]);
    setSelectedTaskIds(new Set());
    setQuery("");

    const children = await loadOccupations(occupation.occupation_code);
    if (children.length === 0) {
      setLoading(true);
      try {
        const occupationTasks = await referenceService.tasks(occupation.occupation_code);
        setTasks(occupationTasks);
        setSelectedTaskIds(new Set(occupationTasks.map((task) => task.task_id)));
      } catch {
        setError("Occupation selected, but its reference tasks could not be loaded.");
      } finally {
        setLoading(false);
      }
    }
  };

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      setOptions(await referenceService.searchOccupations(query.trim()));
    } catch {
      setError("Search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const averageExposure = useMemo(() => {
    const selected = tasks.filter(
      (task) => selectedTaskIds.has(task.task_id) && task.score_2025 !== null,
    );
    if (!selected.length) return null;
    return selected.reduce((sum, task) => sum + (task.score_2025 ?? 0), 0) / selected.length;
  }, [selectedTaskIds, tasks]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <Card className="overflow-hidden border-primary/15 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-card to-accent/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1.5">
                <Database className="h-3.5 w-3.5" /> Live reference data
              </Badge>
              <CardTitle className="text-2xl">Find your closest occupation</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Move from a broad job family to a specific role. You can adjust the suggested tasks next.
              </CardDescription>
            </div>
            <div className="rounded-2xl bg-background/80 p-3 text-primary shadow-sm">
              <BriefcaseBusiness className="h-7 w-7" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void search();
                }}
                placeholder="Search job title or occupation code"
                className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>
            <Button className="h-11 rounded-xl px-5" onClick={() => void search()}>
              Search
            </Button>
          </div>

          {path.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {path.map((item, index) => (
                <div key={item.occupation_code} className="flex items-center gap-2">
                  <button
                    className="rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium transition hover:border-primary/40"
                    onClick={() => void chooseOccupation(item)}
                  >
                    {item.title}
                  </button>
                  {index < path.length - 1 ? (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : tasks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Confirm what you actually do</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTaskIds.size} of {tasks.length} suggested tasks selected
                  </p>
                </div>
                <Badge>{selectedOccupation?.occupation_code}</Badge>
              </div>
              {tasks.map((task) => {
                const selected = selectedTaskIds.has(task.task_id);
                return (
                  <button
                    key={task.task_id}
                    onClick={() => toggleTask(task.task_id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-primary/35 bg-primary/5 shadow-sm"
                        : "bg-background hover:border-primary/20"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="flex-1 text-sm leading-6">{task.task_text}</span>
                    {task.score_2025 !== null ? (
                      <Badge variant="outline">{task.score_2025.toFixed(2)}</Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((occupation) => (
                <button
                  key={occupation.occupation_code}
                  onClick={() => void chooseOccupation(occupation)}
                  className="group rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="outline">{occupation.occupation_code}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="mt-3 font-semibold">{occupation.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {occupation.description ?? `Explore ${occupation.level} occupations`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-0 bg-foreground text-background shadow-xl">
          <CardHeader>
            <Badge className="w-fit bg-background/10 text-background hover:bg-background/15">
              Your profile
            </Badge>
            <CardTitle className="text-xl">
              {selectedOccupation?.title ?? "Start with your occupation"}
            </CardTitle>
            <CardDescription className="text-background/65">
              {selectedOccupation
                ? `MASCO / ISCO code ${selectedOccupation.occupation_code}`
                : "Your selections stay editable throughout the journey."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-background/10 p-4">
                <p className="text-2xl font-semibold">{selectedTaskIds.size}</p>
                <p className="text-xs text-background/60">confirmed tasks</p>
              </div>
              <div className="rounded-xl bg-background/10 p-4">
                <p className="text-2xl font-semibold">
                  {averageExposure === null ? "—" : averageExposure.toFixed(2)}
                </p>
                <p className="text-xs text-background/60">exposure signal</p>
              </div>
            </div>
            <Button
              className="h-11 w-full bg-background text-foreground hover:bg-background/90"
              disabled={!selectedTaskIds.size}
            >
              Continue to AI exposure <ArrowRight />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-primary/5 shadow-none">
          <CardContent className="flex gap-3 p-5">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">A guide, not a verdict</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                AI exposure indicates where work may change. It does not measure your value or predict job loss.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OccupationJourney;
