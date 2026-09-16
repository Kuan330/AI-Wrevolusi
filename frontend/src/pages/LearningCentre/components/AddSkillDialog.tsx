import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { AppButton } from "@/components/ui/app-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/form-field";
import { ROUTES } from "@/constants/routes";
import { skillKey, type LearningSkill } from "@/pages/Skills/learningSkills";
import { aiService, type SkillMatchItem } from "@/services/aiService";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

type AddSkillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addedIds: Set<string>;
  onAdd: (name: string, source: LearningSkill["source"]) => boolean;
};

type SearchState = "idle" | "searching" | "done" | "error";

/** Wait for a pause in typing before asking the matcher. The rules answer
    instantly, so this is only here to avoid a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 200;
/** Below this length there is nothing meaningful to match on. */
const MIN_QUERY_LENGTH = 2;

export default function AddSkillDialog(props: AddSkillDialogProps) {
  const { open, onOpenChange, addedIds, onAdd } = props;
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const cache = useRef(new Map<string, SkillMatchItem[]>());
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SkillMatchItem[]>([]);
  const [state, setState] = useState<SearchState>("idle");

  // The matcher needs the framework as its candidate allowlist, and this dialog
  // needs the same rows to turn a returned id back into a skill name.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (cancelled) return;
        setWefSkills(
          [...rows].sort((left, right) => left.wef_skill_id - right.wef_skill_id),
        );
      })
      .catch(() => {
        if (!cancelled) { setWefSkills([]); setState("error"); }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setMatches([]);
      setState("idle");
    }
  }, [open]);

  // Matching runs as the user types — the dialog used to hide its results
  // behind a Find button that was easy to miss entirely.
  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH || !wefSkills.length) return;
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = JSON.stringify([text.toLowerCase(), wefSkills.map(s => [s.wef_skill_id, s.core_skill])]);
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const cached = cache.current.get(cacheKey);
      if (cached) { setMatches(cached); setState("done"); return; }
      setState("searching");
      void aiService
        .skillMatch({
          fast_only: true,
          task_text: text,
          candidates: wefSkills.map((skill) => ({
            id: skill.wef_skill_id,
            skill: skill.core_skill,
          })),
        }, controller.signal)
        .then((response) => {
          if (cancelled) return;
          const next = response.skills.slice(0, 3);
          if (cache.current.size >= 100) cache.current.clear();
          cache.current.set(cacheKey, next);
          setMatches(next);
          setState("done");
        })
        .catch(() => {
          if (cancelled) return;
          setMatches([]);
          setState("error");
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, wefSkills, open]);

  const skillById = useMemo(
    () => new Map(wefSkills.map((skill) => [skill.wef_skill_id, skill])),
    [wefSkills],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[#e8dff0] px-5 py-4">
          <DialogTitle>Add a skill</DialogTitle>
          <DialogDescription>
            Type the skill's name, or describe what you do with it. Your wording
            is matched against the 26 WEF core skills. Choose from up to three related skills.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4">
          <Input
            value={query}
            maxLength={2000}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setMatches([]);
              setState(value.trim().length >= MIN_QUERY_LENGTH ? "searching" : "idle");
              // Clearing the box drops the results immediately instead of
              // waiting for the debounce to notice.
              if (value.trim().length < MIN_QUERY_LENGTH) {
                setMatches([]);
                setState("idle");
              }
            }}
            placeholder='e.g. inventory, or "I track stock and deal with suppliers"'
            aria-label="Skill name or description"
            autoFocus
          />
          <div className="mt-4 max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
            {state === "idle" ? (
              <p className="py-8 text-center text-sm text-[#7f7280]">
                Start typing — matching skills appear here.
              </p>
            ) : state === "searching" ? (
              <p className="py-8 text-center text-sm text-[#7f7280]" role="status">
                Finding matches…
              </p>
            ) : state === "error" ? (
              <p className="py-8 text-center text-sm text-destructive" role="alert">
                The matcher could not be reached. Please try again.
              </p>
            ) : matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#7f7280]">
                No matching skills found. Try a skill name or describe a work activity more specifically.
              </p>
            ) : (
              matches.map((match) => {
                const skill = skillById.get(match.wef_skill_id);
                if (!skill) return null;
                const added = addedIds.has(skillKey(skill.core_skill));
                return (
                  <div
                    key={match.wef_skill_id}
                    className="flex items-center gap-3 rounded-xl border border-[#e4edf5] bg-white/70 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#2f2430]">
                        {skill.core_skill}
                      </p>
                      <p className="mt-0.5 text-xs text-[#7f7280]">
                        Matched on {match.evidence_phrases.join(", ")}
                      </p>
                    </div>
                    <AppButton
                      type="button"
                      size="sm"
                      tone={added ? "accept" : "blue"}
                      disabled={added}
                      className="h-8 shrink-0 px-3 text-xs"
                      onClick={() => {
                        onAdd(skill.core_skill, "wef");
                      }}
                    >
                      {added ? (
                        <>
                          <Check className="size-3.5" aria-hidden />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" aria-hidden />
                          Add
                        </>
                      )}
                    </AppButton>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter className="items-center border-t border-[#e8dff0] px-5 py-3 gap-3 sm:justify-between">
          <Link
            to={ROUTES.aiExposure}
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center text-xs font-medium text-[#326889] hover:underline"
          >
            Browse every skill on AI Impact
          </Link>
          <AppButton
            type="button"
            tone="blue"
            onClick={() => onOpenChange(false)}
          >
            close
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
