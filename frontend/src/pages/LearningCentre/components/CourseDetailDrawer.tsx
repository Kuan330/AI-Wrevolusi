import { useMemo, useRef, useState } from "react";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { Course } from "../types";
import { durationLabel } from "../lib/coursePlanning";
import { courseLevelLabel } from "../lib/courseLevels";
import { wefSkillsForCourse } from "../lib/courseWorkLinks";
import SkillOutlookBadge from "./SkillOutlookBadge";

export type CourseDetailDrawerProps = {
  course: Course;
  skillName: string;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Called when a badge popover adds or removes a learning skill. */
  onSkillsChanged?: () => void;
};

export default function CourseDetailDrawer(props: CourseDetailDrawerProps) {
  const { course, skillName, saved, onClose, onSave, onSkillsChanged } = props;
  const buildSkills = useMemo(() => wefSkillsForCourse(course.id), [course.id]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const aboutIsLong = course.intro.length > 180;

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent ref={sheetRef} className="learning-detail-drawer">
        <DrawerHeader>
          <p className="library-kicker">{course.provider}</p>
          <DrawerTitle>{course.title}</DrawerTitle>
          <DrawerDescription>
            {courseLevelLabel(course.level)} · {course.language} ·{" "}
            {durationLabel(course.durationMin)}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <a
            className="learning-provider-link"
            href={course.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open provider course
            <ExternalLink size={14} />
          </a>
          <Tabs defaultValue="overview">
            <TabsList className="learning-detail-tabs">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="chapters">Chapters</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="learning-overview">
              <section>
                <h3>About this course</h3>
                <p
                  className={`learning-about${aboutExpanded ? " is-expanded" : ""}`}
                >
                  {course.intro}
                </p>
                {aboutIsLong && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setAboutExpanded((value) => !value)}
                  >
                    {aboutExpanded ? "Show less" : "Show more"}
                  </Button>
                )}
              </section>

              <section className="learning-course-skills">
                <h3>Skills you’ll build</h3>
                {buildSkills.length ? (
                  <ul className="learning-course-skill-badges">
                    {buildSkills.map((skill) => (
                      <li key={skill.wef_skill_id}>
                        <SkillOutlookBadge
                          skill={skill}
                          container={sheetRef}
                          onSkillsChanged={onSkillsChanged}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="library-muted">
                    No linked WEF skills are mapped for this course yet.
                  </p>
                )}
                {skillName ? (
                  <p className="learning-course-skills__focus">
                    Currently browsing via focus skill:{" "}
                    <strong>{skillName}</strong>
                  </p>
                ) : null}
              </section>

              <section>
                <h3>Before you start</h3>
                <p>{course.prereq}</p>
              </section>

              <section className="learning-course-disclaimer">
                <h3>What won’t change</h3>
                <p>
                  Completing this course will not automatically lower your ILO
                  task exposure score. Exposure reflects how a task may be
                  reshaped by AI; learning builds skills and next-step
                  recommendations around that work.
                </p>
              </section>
            </TabsContent>
            <TabsContent value="chapters">
              <p className="library-muted my-4">
                Preview the course structure from the provider.
              </p>
              {course.chapters?.length ? (
                <ol className="learning-chapter-preview">
                  {course.chapters.map((chapter, index) => (
                    <li key={index}>
                      <span className="learning-chapter-number">
                        {index + 1}
                      </span>
                      <span>
                        {chapter.title}
                        <small>{durationLabel(chapter.min)}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  Chapter list not published. This course can be added as a
                  whole.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DrawerBody>
        <div className="learning-drawer-actions">
          <Button
            className={`library-save-button learning-drawer-save${saved ? " is-saved" : ""}`}
            variant="ghost"
            aria-pressed={saved}
            onClick={onSave}
          >
            {saved ? <Trash2 size={16} /> : <Bookmark size={16} />}
            {saved ? "Remove" : "Add to learning"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
