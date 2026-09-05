import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/common/PageHeader";
import { ROUTES } from "@/constants/routes";
import { skillsForTask } from "@/pages/Analysis/lib/matchSkills";
import { AI_CAPACITIES, aiCapacityFromCategory, classifySkillUseTrendFromNetIncreasePercentage, USE_TRENDS } from "@/pages/Analysis/lib/skillAxes";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

const WEF_SOURCE = "https://www.weforum.org/publications/the-future-of-jobs-report-2025/";

const Skills = () => {
  const analysis = readConfirmedAnalysis();
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void referenceService.wefSkills().then(setSkills).catch(() => setSkills([]));
  }, []);

  const taskCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const task of analysis?.tasks ?? []) {
      for (const skill of skillsForTask(task.wording, skills)) {
        counts.set(skill.wef_skill_id, (counts.get(skill.wef_skill_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [analysis?.tasks, skills]);
  const visibleSkills = useMemo(
    () => skills.filter((skill) => skill.core_skill.toLowerCase().includes(query.trim().toLowerCase())),
    [query, skills],
  );

  if (!analysis) {
    return <Navigate to={ROUTES.workProfile} replace />;
  }

  return (
    <div className="analysis-page space-y-5">
      <PageHeader
        title="Skills connected to your work"
        description="See the WEF skills that appear in your confirmed tasks, alongside the wider future-of-work reference data."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline" className="rounded-full"><Link to={ROUTES.aiExposure}>AI exposure</Link></Button>
            <Button asChild className="profile-blue-btn rounded-full"><Link to={ROUTES.task}>Edit tasks</Link></Button>
          </div>
        }
      />

      <Card className="border-[#d6e4f0] bg-[#f7fbfe]">
        <CardHeader>
          <CardTitle>How to read this page</CardTitle>
          <CardDescription>
            Skills are linked to task wording using transparent matching rules. The table makes the relationship visible: linked task count is about your confirmed tasks, while future trend and GenAI capacity come from WEF reference data.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white/75 p-3 text-sm text-[#574a55]"><strong className="text-[#3d5f7a]">Linked tasks</strong><br />How many of your tasks matched this skill.</div>
          <div className="rounded-xl bg-white/75 p-3 text-sm text-[#574a55]"><strong className="text-[#3d5f7a]">Future use</strong><br />Whether the skill is expected to grow, stay stable, or decline from 2025 to 2030.</div>
          <div className="rounded-xl bg-white/75 p-3 text-sm text-[#574a55]"><strong className="text-[#3d5f7a]">AI capacity</strong><br />A WEF category describing GenAI substitution capacity, not your personal proficiency.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>WEF skill reference table</CardTitle>
            <CardDescription>{skills.length} core skills · {taskCounts.size} linked to your current tasks</CardDescription>
          </div>
          <label className="w-full sm:max-w-xs">
            <span className="sr-only">Search skills</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills" className="h-10 w-full rounded-full border border-[#d6e4f0] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#4f91ba]/25" />
          </label>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Skill</TableHead>
                <TableHead>Linked tasks</TableHead>
                <TableHead>Future use, 2025–2030</TableHead>
                <TableHead>GenAI substitution capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSkills.map((skill) => {
                const trend = USE_TRENDS.find((item) => item.id === classifySkillUseTrendFromNetIncreasePercentage(skill.future_net_increase_2025_2030));
                const capacity = AI_CAPACITIES.find((item) => item.id === aiCapacityFromCategory(skill.genai_substitution_capacity_category));
                const linkedTasks = taskCounts.get(skill.wef_skill_id) ?? 0;
                return (
                  <TableRow key={skill.wef_skill_id}>
                    <TableCell className="min-w-52 font-medium text-[#2f2430]">{skill.core_skill}</TableCell>
                    <TableCell><Badge variant={linkedTasks ? "default" : "outline"} className="rounded-full">{linkedTasks}</Badge></TableCell>
                    <TableCell><span className="text-sm text-[#574a55]">{trend?.label ?? "Not classified"}</span>{typeof skill.future_net_increase_2025_2030 === "number" ? <span className="ml-2 text-xs tabular-nums text-[#7f7280]">{skill.future_net_increase_2025_2030 > 0 ? "+" : ""}{skill.future_net_increase_2025_2030}%</span> : null}</TableCell>
                    <TableCell className="text-sm text-[#574a55]">{capacity?.label ?? skill.genai_substitution_capacity_category ?? "Not shown"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {visibleSkills.length === 0 ? <p className="py-8 text-center text-sm text-[#7f7280]">No skills match “{query}”.</p> : null}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1 text-xs text-[#7f7280]">
        Source: <a href={WEF_SOURCE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#3d5f7a] underline underline-offset-2">World Economic Forum, Future of Jobs Report 2025 <ExternalLink className="size-3" aria-hidden /></a>.
        This page describes reference trends and task links; it does not assess personal skill proficiency or make learning recommendations.
      </p>
    </div>
  );
};

export default Skills;
