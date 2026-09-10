import type { Course, RecommendationBasis } from "../types";
type Props = {
  course: Course;
  context: RecommendationBasis;
  skillName: string;
};
export default function ContextStudyAdvice(props: Props) {
  const { course, context, skillName } = props;
  const tasks = context.tasks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const goals = context.goals
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const abilities = context.have
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hasContext = tasks.length + goals.length + abilities.length > 0;
  return (
    <section className="library-tip">
      <h3>{hasContext ? "Apply this course to your work" : "Study tip"}</h3>
      {hasContext ? (
        <>
          <p>
            Use one relevant idea from {course.title} to practise{" "}
            {skillName || "your selected skill"}.
          </p>
          <ol className="list-decimal pl-5 space-y-3">
            <li>
              Choose a small example
              {tasks.length
                ? " from one of your work tasks:"
                : " from your work to practise with."}
              {tasks.length > 0 && (
                <ul className="list-disc pl-4">
                  {tasks.map((task, index) => (
                    <li key={index}>{task}</li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              {abilities.length
                ? "Build on the abilities you confirmed. Use them as a starting point, then practise a new technique from the course:"
                : "Start with an introductory chapter and note which concepts are new to you."}
              {abilities.length > 0 && (
                <ul className="list-disc pl-4">
                  {abilities.map((ability, index) => (
                    <li key={index}>{ability}</li>
                  ))}
                </ul>
              )}
            </li>
            <li>
              {goals.length
                ? "Check your practice result against these learning goals:"
                : "Review what improved, what remains difficult, and what you want to practise next."}
              {goals.length > 0 && (
                <ul className="list-disc pl-4">
                  {goals.map((goal, index) => (
                    <li key={index}>{goal}</li>
                  ))}
                </ul>
              )}
            </li>
          </ol>
          <small>
            Template guidance based on your saved context. Updates automatically
            when you save changes; it does not assess your ability.
          </small>
          <details className="mt-4">
            <summary>Course catalogue study tip</summary>
            <p>{course.advice}</p>
          </details>
        </>
      ) : (
        <>
          <p>{course.advice}</p>
          <small>
            Add work tasks or learning goals in Recommendation basis to get a
            context-based practice template.
          </small>
        </>
      )}
    </section>
  );
}
