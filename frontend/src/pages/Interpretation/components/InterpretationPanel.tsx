import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const InterpretationPanel = () => {
  return (
    <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-4">
      <AccordionItem value="reasoning">
        <AccordionTrigger>Reasoning transparency</AccordionTrigger>
        <AccordionContent>
          Show source, reasoning, uncertainty, and missing-data notes for each key interpretation.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="correction">
        <AccordionTrigger>Correction controls</AccordionTrigger>
        <AccordionContent>
          Users can confirm or correct tasks, exposure labels, and capability interpretations.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default InterpretationPanel;
