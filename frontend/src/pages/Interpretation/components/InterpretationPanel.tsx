import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { readConfirmedCapabilityProfile } from "@/pages/WorkProfile/userProfile";

const InterpretationPanel = () => {
  const capabilityProfile = readConfirmedCapabilityProfile();

  return (
    <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-4">
      <AccordionItem value="reasoning">
        <AccordionTrigger>Reasoning transparency</AccordionTrigger>
        <AccordionContent>
          {capabilityProfile?.capabilities.length ? (
            <div className="space-y-3">
              {capabilityProfile.capabilities.map((capability) => (
                <section key={capability.id} className="rounded-xl border border-border bg-background/70 p-3">
                  <h3 className="font-semibold">{capability.name}</h3>
                  {capability.reasoning ? <p className="mt-1 text-sm">{capability.reasoning}</p> : null}
                  {capability.uncertainty ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <strong>Uncertainty:</strong> {capability.uncertainty}
                    </p>
                  ) : null}
                  {capability.limitations ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Limitation:</strong> {capability.limitations}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            "Confirm your capability profile from the dashboard to review its evidence here."
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="correction">
        <AccordionTrigger>Correction controls</AccordionTrigger>
        <AccordionContent>
          {capabilityProfile?.capabilities.length ? (
            <ul className="space-y-3">
              {capabilityProfile.capabilities.map((capability) => (
                <li key={capability.id} className="rounded-xl border border-border bg-background/70 p-3">
                  <p className="font-semibold">{capability.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {capability.linkedTaskIds.length} linked task(s)
                    {capability.evolution ? ` · ${capability.evolution.replaceAll("_", " ")}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    {capability.workplaceExample || "No workplace example was recorded."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            "No confirmed capability profile is available yet."
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default InterpretationPanel;
