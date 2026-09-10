import { useId } from "react";
import { Info } from "lucide-react";
export default function OccupationName(props: {
  title: string;
  path: string[];
}) {
  const { title, path } = props;
  const tooltipId = useId();
  return (
    <span className="occupation-name">
      <strong>{title}</strong>
      {path.length > 0 && (
        <span className="occupation-name__details">
          <button
            type="button"
            className="occupation-name__button"
            aria-label="Occupation classification path"
            aria-describedby={tooltipId}
          >
            <Info aria-hidden="true" />
          </button>
          <span
            id={tooltipId}
            role="tooltip"
            className="occupation-name__tooltip"
          >
            {path.join(" → ")}
          </span>
        </span>
      )}
    </span>
  );
}
