import { useState } from "react";
import { Button } from "../../components/Button";
import { Modal, ConfirmBar } from "../../components/Modal";
import { TaskRow } from "../../components/TaskRow";

function listenSpeech(onText, onFail) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onFail();
    return;
  }
  const rec = new SR();
  rec.lang = "en-MY";
  rec.onresult = (e) => onText(e.results[0][0].transcript);
  rec.start();
}

export function OccupationTaskPanel({ tasks, onChange, onToast }) {
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({ name: "", time: "", responsibility: "", speech: false });
  const [hint, setHint] = useState("");

  function close() {
    setModal(null);
  }

  function addTask() {
    const name = draft.name.trim();
    if (!name) {
      onToast("Task wording cannot be empty.");
      return;
    }
    onChange([
      ...tasks,
      {
        id: "u" + Date.now(),
        ilo_task_id: "",
        name,
        status: "suggested",
        input_method: draft.speech ? "speech" : "typed",
        time: draft.time,
        responsibility: draft.responsibility,
        is_user_added: true,
      },
    ]);
    setHint("Task added.");
    close();
  }

  function saveEdit() {
    const name = draft.name.trim();
    if (!name) {
      onToast("Task wording cannot be empty.");
      return;
    }
    onChange(tasks.map((t) => (t.id === draft.id ? { ...t, name, status: "edited" } : t)));
    close();
  }

  function removeTask() {
    onChange(tasks.filter((t) => t.id !== draft.id));
    close();
  }

  return (
    <div className="task-editor">
      <div className="actions" style={{ marginTop: 0 }}>
        <strong>{tasks.length} tasks</strong>
        <Button
          variant="soft"
          small
          type="button"
          onClick={() => {
            setDraft({ name: "", time: "", responsibility: "", speech: false });
            setModal("add");
          }}
        >
          + Add task
        </Button>
      </div>
      <div className="list">
        {tasks.length === 0 ? (
          <p className="meta">No tasks yet. Use + Add task.</p>
        ) : (
          tasks.map((t) => (
            <TaskRow
              key={t.id}
              title={t.name}
              meta={t.is_user_added || !t.ilo_task_id ? "Added by you" : "Starter task"}
              actions={
                <>
                  <Button
                    variant="ghost"
                    small
                    type="button"
                    onClick={() => {
                      setDraft({ id: t.id, name: t.name });
                      setModal("edit");
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    small
                    type="button"
                    onClick={() => {
                      setDraft({ id: t.id, name: t.name });
                      setModal("remove");
                    }}
                  >
                    Remove
                  </Button>
                </>
              }
            />
          ))
        )}
      </div>
      {hint ? <p className="hint">{hint}</p> : null}

      {modal === "add" ? (
        <Modal
          nested
          title="Add a task"
          onClose={close}
          actions={
            <>
              <Button variant="ghost" type="button" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="soft"
                small
                type="button"
                onClick={() =>
                  listenSpeech(
                    (text) => setDraft((d) => ({ ...d, name: `${d.name} ${text}`.trim(), speech: true })),
                    () => onToast("Speech is not available in this browser.")
                  )
                }
              >
                Speak
              </Button>
              <Button variant="primary" type="button" onClick={addTask}>
                Add task
              </Button>
            </>
          }
        >
          <p className="body">Describe a task you actually perform.</p>
          <label className="field">
            Task wording
            <textarea rows={3} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            Time spent (optional)
            <select value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })}>
              <option value="">Skip</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </label>
          <label className="field">
            Responsibility (optional)
            <select value={draft.responsibility} onChange={(e) => setDraft({ ...draft, responsibility: e.target.value })}>
              <option value="">Skip</option>
              <option>Support</option>
              <option>Shared</option>
              <option>Accountable</option>
            </select>
          </label>
        </Modal>
      ) : null}

      {modal === "edit" ? (
        <Modal nested title="Edit task" onClose={close} actions={<ConfirmBar onCancel={close} onOk={saveEdit} okLabel="Save" />}>
          <label className="field">
            Task wording
            <textarea rows={3} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
        </Modal>
      ) : null}

      {modal === "remove" ? (
        <Modal nested title="Remove this task?" onClose={close} actions={<ConfirmBar onCancel={close} onOk={removeTask} okLabel="Remove" danger />}>
          <p className="body">{draft.name}</p>
        </Modal>
      ) : null}
    </div>
  );
}
