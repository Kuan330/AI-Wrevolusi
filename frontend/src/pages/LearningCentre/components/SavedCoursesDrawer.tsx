import { ArrowRight, Bookmark, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { courses } from "../catalogue";
export type SavedCoursesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: string[];
  onRemove: (id: string) => void;
  onPlan: (id: string) => void;
  onExport: (ids: string[]) => void;
  plannedIds: string[];
};
export default function SavedCoursesDrawer(props: SavedCoursesDrawerProps) {
  const { open, onOpenChange, saved, onRemove, onPlan, onExport, plannedIds } =
    props;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Saved courses</DrawerTitle>
          <DrawerDescription>
            Your shortlist. Save now and decide when to learn later.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {!saved.length ? (
            <div className="library-empty">
              <Bookmark className="mx-auto mb-3" />
              <p>No saved courses yet.</p>
              <p>Use the bookmark on a course to keep it here.</p>
            </div>
          ) : (
            courses
              .filter((course) => saved.includes(course.id))
              .map((course) => (
                <section className="library-saved-item" key={course.id}>
                  <p className="library-kicker">{course.provider}</p>
                  <h3 className="font-semibold my-2">{course.title}</h3>
                  <div className="library-row">
                    <Button variant="link" onClick={() => onPlan(course.id)}>
                      {plannedIds.includes(course.id)
                        ? "Edit learning plan"
                        : "Plan learning"}
                      <ArrowRight size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${course.title} from saved courses`}
                      onClick={() => onRemove(course.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </section>
              ))
          )}
        </DrawerBody>
        <div className="learning-drawer-actions">
          <p className="text-xs text-muted-foreground">
            Removing a saved course does not delete its plan.
          </p>
          <Button
            variant="outline"
            disabled={!saved.length}
            onClick={() => onExport(saved)}
          >
            Export list
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
