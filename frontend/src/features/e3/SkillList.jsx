import { useState } from "react";
import { INTERPRET, interpLabel } from "../../constants";
import { Button } from "../../components/Button";
import { Modal, ConfirmBar } from "../../components/Modal";
import { TaskRow } from "../../components/TaskRow";

export function SkillList({ caps, wefCatalog, onChange, onToast }) {
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({ name: "", custom: "", interpretation: "continue_useful" });

  function close() {
    setModal(null);
  }

  return (
    <>
      <div className="actions" style={{ marginTop: 0 }}>
        <span />
        <Button
          variant="soft"
          small
          type="button"
          onClick={() => {
            setDraft({ name: "", custom: "", interpretation: "continue_useful" });
            setModal("add");
          }}
        >
          + Add skill
        </Button>
      </div>
      <div className="list">
        {caps.length === 0 ? (
          <p className="meta">No skills yet. Add one from the WEF list or in your own words.</p>
        ) : (
          caps.map((c, i) => (
            <TaskRow
              key={c.id}
              title={c.name}
              badges={<span className="badge b-pink">{interpLabel(c.interpretation)}</span>}
              actions={
                <>
                  <Button variant="ghost" small type="button" onClick={() => setModal({ type: "basis", i })}>
                    Detail
                  </Button>
                  <Button
                    variant="soft"
                    small
                    type="button"
                    onClick={() => {
                      setDraft({ i, name: c.name, interpretation: c.interpretation });
                      setModal({ type: "edit", i });
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="danger" small type="button" onClick={() => setModal({ type: "remove", i })}>
                    Remove
                  </Button>
                </>
              }
            />
          ))
        )}
      </div>

      {modal === "add" ? (
        <Modal
          title="Add a skill"
          onClose={close}
          actions={
            <ConfirmBar
              onCancel={close}
              okLabel="Add"
              onOk={() => {
                const custom = draft.custom.trim();
                const name = custom || draft.name;
                if (!name) {
                  onToast("Choose or type a skill.");
                  return;
                }
                const hit = wefCatalog.find((s) => s.core_skill === name);
                onChange([
                  ...caps,
                  {
                    id: "cap-u" + Date.now(),
                    wef_skill_id: hit?.wef_skill_id || null,
                    name,
                    interpretation: draft.interpretation,
                    why: custom ? "Added in your own words." : "Chosen from WEF 26.",
                    is_user_added: Boolean(custom),
                  },
                ]);
                close();
              }}
            />
          }
        >
          <label className="field">
            WEF core skill
            <select value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}>
              <option value="">Type my own…</option>
              {wefCatalog.map((s) => (
                <option key={s.wef_skill_id} value={s.core_skill}>
                  {s.core_skill}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Or your own words
            <input value={draft.custom} onChange={(e) => setDraft({ ...draft, custom: e.target.value })} />
          </label>
          <label className="field">
            How it may evolve
            <select value={draft.interpretation} onChange={(e) => setDraft({ ...draft, interpretation: e.target.value })}>
              {INTERPRET.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      ) : null}

      {modal?.type === "basis" ? (
        <Modal
          title="Skill basis"
          onClose={close}
          actions={
            <Button variant="primary" type="button" onClick={close}>
              Close
            </Button>
          }
        >
          <div className="body">
            <p>
              <strong>{caps[modal.i].name}</strong>
            </p>
            <p>May evolve as: {interpLabel(caps[modal.i].interpretation)}</p>
            <p>{caps[modal.i].why}</p>
            <p>This is not a readiness score or certificate.</p>
          </div>
        </Modal>
      ) : null}

      {modal?.type === "edit" ? (
        <Modal
          title="Edit skill"
          onClose={close}
          actions={
            <ConfirmBar
              onCancel={close}
              okLabel="Save"
              onOk={() => {
                const name = draft.name.trim();
                if (!name) {
                  onToast("Name cannot be empty.");
                  return;
                }
                onChange(caps.map((c, i) => (i === draft.i ? { ...c, name, interpretation: draft.interpretation } : c)));
                close();
              }}
            />
          }
        >
          <label className="field">
            Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            How it may evolve
            <select value={draft.interpretation} onChange={(e) => setDraft({ ...draft, interpretation: e.target.value })}>
              {INTERPRET.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </Modal>
      ) : null}

      {modal?.type === "remove" ? (
        <Modal
          title="Remove this skill?"
          onClose={close}
          actions={
            <ConfirmBar
              onCancel={close}
              okLabel="Remove"
              danger
              onOk={() => {
                onChange(caps.filter((_, i) => i !== modal.i));
                close();
              }}
            />
          }
        >
          <p className="body">{caps[modal.i].name}</p>
        </Modal>
      ) : null}
    </>
  );
}
