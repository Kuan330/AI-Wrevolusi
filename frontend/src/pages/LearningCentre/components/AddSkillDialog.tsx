import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { skillKey } from "@/pages/Skills/learningSkills";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

type AddSkillDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addedIds: Set<string>;
  onAdd: (name: string, source: "wef" | "custom") => boolean;
};

export default function AddSkillDialog(props: AddSkillDialogProps) {
  const { open, onOpenChange, addedIds, onAdd } = props;
  const [wefSkills, setWefSkills] = useState<WefSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (cancelled) return;
        setWefSkills(
          [...rows].sort(
            (left, right) => left.wef_skill_id - right.wef_skill_id,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setWefSkills([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCustomName("");
      setCustomError("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return wefSkills;
    return wefSkills.filter((skill) =>
      skill.core_skill.toLowerCase().includes(needle),
    );
  }, [query, wefSkills]);

  const submitCustom = () => {
    const name = customName.trim();
    if (!name) {
      setCustomError("Enter a skill name.");
      return;
    }
    if (addedIds.has(skillKey(name))) {
      setCustomError("This skill is already in your list.");
      return;
    }
    const ok = onAdd(name, "custom");
    if (ok) {
      setCustomName("");
      setCustomError("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-[#e8dff0] px-5 py-4">
          <DialogTitle>Add a skill</DialogTitle>
          <DialogDescription>
            Choose from the WEF framework, or add a skill of your own.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="wef" className="px-5 py-4">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="wef">WEF skills (26)</TabsTrigger>
            <TabsTrigger value="custom">Custom skill</TabsTrigger>
          </TabsList>
          <TabsContent value="wef" className="mt-0 space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills…"
              aria-label="Search WEF skills"
            />
            <div className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
              {loading ? (
                <p className="py-8 text-center text-sm text-[#7f7280]">
                  Loading skills…
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#7f7280]">
                  No skills match this search.
                </p>
              ) : (
                filtered.map((skill) => {
                  const id = skillKey(skill.core_skill);
                  const added = addedIds.has(id);
                  return (
                    <div
                      key={skill.wef_skill_id}
                      className="flex items-center gap-2 rounded-xl border border-[#e4edf5] bg-white/70 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 text-sm font-medium text-[#2f2430]">
                        {skill.core_skill}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={added}
                        className="shrink-0 rounded-full"
                        onClick={() => {
                          if (onAdd(skill.core_skill, "wef")) {
                            /* keep dialog open so user can add more */
                          }
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
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
          <TabsContent value="custom" className="mt-0 space-y-3">
            <label className="block text-sm text-[#574a55]">
              Skill name
              <Input
                className="mt-1.5"
                value={customName}
                onChange={(event) => {
                  setCustomName(event.target.value);
                  setCustomError("");
                }}
                placeholder="e.g. Stakeholder communication"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitCustom();
                  }
                }}
              />
            </label>
            {customError ? (
              <p className="text-sm text-destructive" role="alert">
                {customError}
              </p>
            ) : (
              <p className="text-xs text-[#7f7280]">
                Custom skills stay in your list. They may not match catalogue
                courses yet.
              </p>
            )}
            <AppButton tone="gradient" type="button" onClick={submitCustom}>
              Add custom skill
            </AppButton>
          </TabsContent>
        </Tabs>
        <DialogFooter className="border-t border-[#e8dff0] px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
