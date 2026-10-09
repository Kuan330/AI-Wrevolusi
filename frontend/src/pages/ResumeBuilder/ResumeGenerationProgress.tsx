/** A non-streaming request has no measurable completion percentage. */
export default function ResumeGenerationProgress({ seconds }: { seconds: number }) {
  const elapsed = Math.max(0, Math.floor(seconds));
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <div className="rb-generation-progress">
      <div className="rb-generation-progress-heading">
        <span role="status" aria-live="polite">Tailoring your resume</span>
        <span className="rb-generation-elapsed" aria-hidden="true">{time}</span>
      </div>
      <div className="rb-generation-track" role="progressbar" aria-label="Tailoring your resume" aria-busy="true">
        <span className="rb-generation-indicator" />
      </div>
    </div>
  );
}
