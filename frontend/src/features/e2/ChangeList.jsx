import { useState } from "react";
import { EXPOSURE_STATES, stateLabel } from "../../constants";
import { Button } from "../../components/Button";
import { Modal, ConfirmBar } from "../../components/Modal";
import { TaskRow } from "../../components/TaskRow";

export function ChangeList({ tasks, changes, onChange }) {
  const [modal, setModal] = useState(null);
  const [hint, setHint] = useState("");
  const [draft, setDraft] = useState({ id: "", suggested_state: "", why: "" });

  const row = (id) => changes[id] || { suggested_state: "insufficient_data", match_layer: "insufficient_data", why: "" };

  return (
    <>
      <div className="list">
        {tasks.map((t) => {
          const c = row(t.id);
          return (
            <TaskRow
              key={t.id}
              title={t.name}
              meta="Possible change — not a job-loss prediction."
              badges={
                <>
                  <span className="badge b-blue">{stateLabel(c.suggested_state)}</span>
                  <span className="badge b-pink">{c.match_layer}</span>
                </>
              }
              actions={
                <>
                  <Button variant="ghost" small type="button" onClick={() => setModal({ type: "why", id: t.id })}>
                    Detail
                  </Button>
                  <Button
                    variant="soft"
                    small
                    type="button"
                    onClick={() => {
                      setDraft({ id: t.id, suggested_state: c.suggested_state, why: c.why });
                      setModal({ type: "edit", id: t.id });
                    }}
                  >
                    Edit
                  </Button>
                </>
              }
            />
          );
        })}
      </div>
      {hint ? <p className="hint">{hint}</p> : null}

      {modal?.type === "why" ? (
        <Modal
          title="Why this interpretation"
          onClose={() => setModal(null)}
          actions={
            <Button variant="primary" type="button" onClick={() => setModal(null)}>
              Close
            </Button>
          }
        >
          <div className="body">
            <p>
              <strong>Task:</strong> {tasks.find((t) => t.id === modal.id)?.name}
            </p>
            <p>
              <strong>Suggested state:</strong> {stateLabel(row(modal.id).suggested_state)}
            </p>
            <p>
              <strong>Match layer:</strong> {row(modal.id).match_layer}
            </p>
            <p>
              <strong>Reasoning:</strong> {row(modal.id).why}
            </p>
            <p>Limitation: Describes possible task transformation only — not job replacement.</p>
          </div>
        </Modal>
      ) : null}

      {modal?.type === "edit" ? (
        <Modal
          title="Edit interpretation"
          onClose={() => setModal(null)}
          actions={
            <ConfirmBar
              onCancel={() => setModal(null)}
              okLabel="Save"
              onOk={() => {
                onChange({
                  ...changes,
                  [draft.id]: {
                    ...row(draft.id),
                    suggested_state: draft.suggested_state,
                    why: draft.why.trim() || row(draft.id).why,
                  },
                });
                setHint("Interpretation updated.");
                setModal(null);
              }}
            />
          }
        >
          <label className="field">
            Interpretation
            <select value={draft.suggested_state} onChange={(e) => setDraft({ ...draft, suggested_state: e.target.value })}>
              {EXPOSURE_STATES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Short reason
            <textarea rows={3} value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} />
          </label>
        </Modal>
      ) : null}
    </>
  );
}
