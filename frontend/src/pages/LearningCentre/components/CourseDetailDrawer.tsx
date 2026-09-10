import { useState } from "react";
import { Bookmark, Check, ExternalLink, ArrowRight } from "lucide-react";
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
import { AppButton } from "@/components/ui/app-button";
import { Link } from "react-router-dom";
import type { Course, CourseChoice, RecommendationBasis } from "../types";
import { durationLabel } from "../lib/coursePlanning";
import ContextStudyAdvice from "./ContextStudyAdvice";
import LearningPlanSteps from "./LearningPlanSteps";
export type CourseDetailDrawerProps = {
  course: Course;
  context: RecommendationBasis;
  skillName: string;
  choice: CourseChoice;
  saved: boolean;
  inPlan: boolean;
  scheduled: boolean;
  startPlanning: boolean;
  onClose: () => void;
  onSave: () => void;
  onCommit: (choice: CourseChoice) => boolean;
};
export default function CourseDetailDrawer(props: CourseDetailDrawerProps) {
  const {
    course,
    context,
    skillName,
    choice,
    saved,
    inPlan,
    scheduled,
    startPlanning,
    onClose,
    onSave,
    onCommit,
  } = props;
  const [planning, setPlanning] = useState(startPlanning);
  const planProps = {
    course,
    initialChoice: choice,
    inPlan,
    onBack: () => setPlanning(false),
    onClose,
    onCommit,
  };
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent className="learning-detail-drawer">
        <DrawerHeader>
          <p className="library-kicker">
            {planning ? "Plan your learning" : course.provider}
          </p>
          <DrawerTitle>{course.title}</DrawerTitle>
          <DrawerDescription>
            {course.provider} ·{" "}
            {course.level === "unknown" ? "Level not stated" : course.level} ·{" "}
            {course.language} · {durationLabel(course.durationMin)}
          </DrawerDescription>
        </DrawerHeader>
        {planning ? (
          <LearningPlanSteps {...planProps} />
        ) : (
          <>
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
                    <p>{course.intro}</p>
                  </section>
                  <section>
                    <h3>What you will learn</h3>
                    <ul>
                      {course.outcomes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3>Before you start</h3>
                    <p>{course.prereq}</p>
                  </section>
                  <ContextStudyAdvice {...{ course, context, skillName }} />
                </TabsContent>
                <TabsContent value="chapters">
                  <p className="library-muted my-4">
                    Preview the course structure. Choose what to include when
                    you plan your learning.
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
              <Button variant="ghost" aria-pressed={saved} onClick={onSave}>
                {saved ? <Check size={16} /> : <Bookmark size={16} />}
                {saved ? "Saved" : "Save for later"}
              </Button>
              <div className="library-actions">
                {scheduled && (
                  <Button asChild variant="link">
                    <Link to="/plan">View plan</Link>
                  </Button>
                )}
                <AppButton tone="gradient" onClick={() => setPlanning(true)}>
                  {inPlan || scheduled ? "Edit learning plan" : "Plan learning"}
                  <ArrowRight size={16} />
                </AppButton>
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
