import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input } from "@/components/ui/form-field";
import { readModelIds, restoreDefaultModels, saveModelIds } from "@/infrastructure/storage/modelPreferences";
export default function DeveloperModelsDialog({ open, onOpenChange, restoreFocus }: { open: boolean; onOpenChange: (open: boolean) => void; restoreFocus?: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{open && <DeveloperModelsContent close={() => onOpenChange(false)} restoreFocus={restoreFocus} />}</Dialog>;
}
function DeveloperModelsContent({ close, restoreFocus }: { close: () => void; restoreFocus?: () => void }) {
  const [models, setModels] = useState<string[]>(() => { const current = readModelIds(); return current.length ? current : [""]; }), [error, setError] = useState("");
  const move = (index: number, direction: number) => setModels(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  return <DialogContent className="developer-model-dialog" onCloseAutoFocus={event => { if (restoreFocus) { event.preventDefault(); restoreFocus(); } }}><DialogHeader><DialogTitle>Developer settings</DialogTitle><DialogDescription>Model priority for all AI features in this browser only. Other users and server defaults are unchanged.</DialogDescription></DialogHeader>
    <p className="text-sm text-muted-foreground">Requests use the configured primary AI service, trying these models in order when a model is unavailable. This is a local preference, not an administrator console.</p>
    <div className="space-y-3">{models.map((model, index) => <div key={index} className="flex items-end gap-2"><div className="min-w-0 flex-1"><FormField label={`Priority ${index + 1}`}><Input aria-label={`Model ID priority ${index + 1}`} maxLength={160} value={model} placeholder="Model ID" onChange={event => setModels(current => current.map((value, i) => i === index ? event.target.value : value))} /></FormField></div><Button variant="ghost" size="icon" aria-label={`Move model ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon" aria-label={`Move model ${index + 1} down`} disabled={index === models.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button><Button variant="ghost" size="icon" aria-label={`Remove model ${index + 1}`} disabled={models.length === 1} onClick={() => setModels(current => current.filter((_, i) => i !== index))}><Trash2 /></Button></div>)}</div>
    <Button variant="outline" disabled={models.length >= 5} onClick={() => setModels(current => [...current, ""])}><Plus />Add model</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={() => { try { restoreDefaultModels(); close(); } catch { setError("Browser storage is unavailable. Defaults were not restored."); } }}>Restore defaults</Button><Button onClick={() => { try { saveModelIds(models); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this preference."); } }}>Apply</Button></DialogFooter>
  </DialogContent>;
}
