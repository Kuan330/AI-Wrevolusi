import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
export default function YamlEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const container = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null);
  const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    if (!container.current) return;
    const editor = new EditorView({ parent: container.current, state: EditorState.create({ doc: value, extensions: [
      lineNumbers(), highlightActiveLine(), history(), yaml(), keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping, EditorView.contentAttributes.of({ "aria-label": "RenderCV YAML document", spellcheck: "false" }),
      EditorView.theme({ "&": { backgroundColor: "#fffdfd", fontSize: "13px" }, ".cm-content": { fontFamily: "Consolas, monospace", minHeight: "500px" }, ".cm-gutters": { backgroundColor: "#f3f0f6", color: "#897d90", border: "none" }, ".cm-focused": { outline: "none" } }),
      EditorView.updateListener.of(update => { if (update.docChanged) change.current(update.state.doc.toString()); }),
    ] }) });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
    // The editor is controlled below; don't rebuild it on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);
  return <div className="rb-yaml" ref={container} />;
}
