import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea, FormField } from "@/components/ui/form-field";
import type { LearningSelection } from "@/features/resume/types";
import type { LearningRecord } from "@/features/resume/learningRecords";
export default function ResumeLearningRecords({ records, selections, loading, error, retry, change }: { records: LearningRecord[]; selections: LearningSelection[]; loading: boolean; error: string; retry: () => void; change: (selections: LearningSelection[]) => void }) {
  return <Accordion type="single" collapsible className="rb-learning-records"><AccordionItem value="learning"><AccordionTrigger>Learning records · {selections.length} selected</AccordionTrigger><AccordionContent>
    <p>Choose factual learning records to include, review the description and remove confidential information. Completed courses reflect your synchronised chapter progress; they are not external certificates or an assessment of mastery. No completion date is inferred.</p>
    {loading && <p role="status">Loading synchronised learning records…</p>}
    {error && <p className="rb-warning" role="alert">{error} <Button variant="link" size="sm" onClick={retry}>Retry learning records</Button></p>}
    {!loading && !error && !records.length && <p>No completed courses or recorded practice are available yet. Unfinished or unsynchronised course progress is not completion evidence.</p>}
    {records.map(record => {
      const selection = selections.find(row => row.recordId === record.id);
      const current = selection?.recordFingerprint === record.fingerprint;
      return <div className="rb-learning-record" key={record.id}>
        <label className="rb-check"><Checkbox checked={Boolean(selection)} onCheckedChange={checked => change(checked === true ? [...selections.filter(row => row.recordId !== record.id), { recordId: record.id, text: record.text, reviewed: false, recordFingerprint: record.fingerprint }] : selections.filter(row => row.recordId !== record.id))} />{record.label} · {record.kind === "course_completion" ? "You recorded this course as completed" : record.kind.replaceAll("_", " ")}</label>
        {selection && <><FormField label="Learning description to include" hint="Preserve its factual nature. Learning practice stays practice; it does not become employment, a project or a certificate."><Textarea rows={3} maxLength={1700} value={selection.text} onChange={event => change(selections.map(row => row.recordId === record.id ? { ...row, text: event.target.value, reviewed: false } : row))} /></FormField>
        {!current && <p className="rb-warning">This record changed. Review your description against the current record: {record.text}</p>}
        <label className="rb-check"><Checkbox checked={selection.reviewed && current} onCheckedChange={checked => change(selections.map(row => row.recordId === record.id ? { ...row, reviewed: checked === true, recordFingerprint: record.fingerprint } : row))} />I reviewed this self-recorded learning description and removed confidential information.</label></>}
      </div>;
    })}
    {selections.filter(selection => !records.some(record => record.id === selection.recordId)).map(selection => <p className="rb-warning" key={selection.recordId}>A selected record is no longer available. Your reviewed description has been kept. <Button size="sm" variant="link" onClick={() => change(selections.filter(row => row.recordId !== selection.recordId))}>Remove unavailable record</Button></p>)}
  </AccordionContent></AccordionItem></Accordion>;
}
