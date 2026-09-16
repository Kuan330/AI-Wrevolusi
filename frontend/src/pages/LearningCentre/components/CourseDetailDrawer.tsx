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

export type CourseDetailDrawerProps = {
  course: Course;
  skillName: string;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function CourseDetailDrawer(props: CourseDetailDrawerProps) {
  const { course, skillName, saved, onClose, onSave } = props;
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent className="learning-detail-drawer">
        <DrawerHeader>
          <p className="library-kicker">{course.provider}</p>
          <DrawerTitle>{course.title}</DrawerTitle>
          <DrawerDescription>
            {course.provider} · {courseLevelLabel(course.level)} ·{" "}
            {course.language} · {durationLabel(course.durationMin)}
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
              {skillName ? (
                <section className="learning-apply-box">
                  <h3>Apply this course to your work</h3>
                  <p>
                    Linked to your focus skill: <strong>{skillName}</strong>
                  </p>
                </section>
              ) : null}
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
            className={`library-save-button${saved ? " soft-btn-red" : " soft-btn-blue"}`}
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
