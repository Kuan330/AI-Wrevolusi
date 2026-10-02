import { cleanDisplayText } from "@/lib/displayText";
import { safeProviderUrl } from "@/features/course-workspace/courseWorkspace";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bookmark, ExternalLink, Trash2 } from "lucide-react";
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
import type { Course } from "../../../features/learning-planning/types";
import { durationLabel } from "../lib/coursePlanning";
import { courseLevelLabel } from "../lib/courseLevels";
import { useNavigate } from "react-router-dom";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { planCourseUrl, rememberCourse } from "@/features/journey/journey";

export type CourseDetailDrawerProps = {
  course: Course;
  skillName: string;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  busy?: boolean;
  saveDisabled?: boolean;
  pendingSync?: boolean;
  saveNotice?: string;
  onRetrySync?: () => void;
  linkedSkills?: string[];
  learningRecords?: { id: string; label: string; saved: boolean }[];
  onSelectRecord?: (id: string) => void;
};

export default function CourseDetailDrawer(props: CourseDetailDrawerProps) {
  const { course, skillName, saved, onClose, onSave, busy, saveDisabled, pendingSync, saveNotice, onRetrySync, linkedSkills, learningRecords, onSelectRecord } = props;
  // Providers publish outcomes as one semicolon-separated sentence, so only the
  // first clause is capitalised and only the last one keeps its full stop.
  // Normalise them into standalone list items.
  const outcomes = useMemo(
    () =>
      course.outcomes
        .map((item) => cleanDisplayText(item).replace(/[.;]+$/, ""))
        .filter(Boolean)
        .map((item) => item.charAt(0).toUpperCase() + item.slice(1)),
    [course.outcomes],
  );
  const providerUrl = safeProviderUrl(course.url);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const aboutIsLong = course.intro.length > 180;
  const navigate = useNavigate();
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const continueCourse = async () => {
    if (continuing || busy || pendingSync) return;
    const owner = currentWorkspaceSession();
    setContinuing(true);
    setContinueError("");
    try {
      await rememberCourse(course.id);
      if (mounted.current && owner === currentWorkspaceSession()) navigate(planCourseUrl(course.id));
    } catch (error) {
      if (mounted.current && owner === currentWorkspaceSession()) setContinueError(error instanceof Error && !/(?:status|http|request failed|fetch|network)/i.test(error.message) ? cleanDisplayText(error.message) : "Could not save your place. Please try again.");
    } finally {
      if (mounted.current && owner === currentWorkspaceSession()) setContinuing(false);
    }
  };

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent ref={sheetRef} className="learning-detail-drawer">
        <DrawerHeader>
          <p className="library-kicker">{cleanDisplayText(course.provider)}</p>
          <DrawerTitle>{cleanDisplayText(course.title)}</DrawerTitle>
          <DrawerDescription>
            {courseLevelLabel(course.level)} · {cleanDisplayText(course.language)} ·{" "}
            {durationLabel(course.durationMin)}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {providerUrl ? <a
            className="learning-provider-link"
            href={providerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open provider course
            <ExternalLink size={14} />
          </a> : <p className="library-muted">A provider link is not available for this course.</p>}
          {linkedSkills && linkedSkills.length > 0 && <p className="library-linked-skills"><strong>Linked skills:</strong> {linkedSkills.map(cleanDisplayText).join(" · ")}</p>}
          {learningRecords && learningRecords.length > 1 && <section className="learning-course-records" aria-label="Learning records for linked skills">
            <h3>Learning records for linked skills</h3>
            <p className="library-muted">Each linked skill keeps its own saved course. Choose a record to view or change it.</p>
            <div className="library-record-options">{learningRecords.map(record => <Button key={record.id} size="sm" variant="outline" aria-pressed={record.id === course.id} disabled={busy || continuing || pendingSync} onClick={() => onSelectRecord?.(record.id)}>{cleanDisplayText(record.label)}{record.saved ? " · Added" : ""}</Button>)}</div>
          </section>}
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
                  {cleanDisplayText(course.intro)}
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
                <h3>What you’ll learn</h3>
                {outcomes.length ? (
                  <ul className="learning-course-outcomes">
                    {outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="library-muted">
                    The provider has not published learning outcomes for this
                    course yet.
                  </p>
                )}
                {skillName ? (
                  <p className="learning-course-skills__focus">
                    Currently browsing via focus skill:{" "}
                    <strong>{cleanDisplayText(skillName)}</strong>
                  </p>
                ) : null}
              </section>

              <section>
                <h3>Before you start</h3>
                <p>{cleanDisplayText(course.prereq)}</p>
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
                        {cleanDisplayText(chapter.title)}
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
        {saveNotice && <p role="alert">{saveNotice}</p>}
        {pendingSync && !saveNotice && <p role="status">Your course changes are on this browser. Waiting for your account to confirm the save.</p>}
        {continueError && <p role="alert">{continueError}</p>}
        <div className="learning-drawer-actions">
          {pendingSync && <Button disabled={busy} onClick={onRetrySync}>{busy ? "Syncing…" : "Retry sync"}</Button>}
          {saved && (
            <Button disabled={busy || continuing || pendingSync} onClick={() => { void continueCourse(); }}>
              {continuing ? "Saving your place…" : "Continue with this course"} <ArrowRight size={16} />
            </Button>
          )}
          <Button
            className={`library-save-button learning-drawer-save${saved ? " is-saved" : ""}`}
            variant="ghost"
            aria-pressed={saved}
            disabled={busy || continuing || pendingSync || (!saved && saveDisabled)}
            onClick={onSave}
          >
            {saved ? <Trash2 size={16} /> : <Bookmark size={16} />}
            {busy ? "Saving…" : saved ? "Remove from My courses" : "Add to My courses"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
