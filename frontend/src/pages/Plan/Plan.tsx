import { Link, useSearchParams } from "react-router-dom";
import MyCourses from "@/pages/MyCourses/MyCourses";
import PlanStudyWorkspace from "./PlanStudyWorkspace";

/** Preserve the study calendar without making it the course-library landing page. */
export default function Plan() {
  const [params] = useSearchParams();
  return params.get("view") === "schedule" ? <><Link to="/learning/plan/courses" className="courses-back" style={{ marginBottom: 18 }}>← Back to My courses</Link><PlanStudyWorkspace /></> : <MyCourses />;
}
