import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CapabilityEvidence from "@/pages/Capabilities/components/CapabilityEvidence";
import type { Capability } from "@/types/capability";

interface CapabilityCardProps {
  capability: Capability;
}

const labelMap = {
  continue_to_be_useful: "Continue to be useful",
  needs_strengthening: "Needs strengthening",
  needs_updating: "Needs updating as tasks change",
} as const;

const CapabilityCard = ({ capability }: CapabilityCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{capability.name}</CardTitle>
          <Badge variant="outline">{labelMap[capability.evolution]}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Linked tasks: {capability.linkedTaskIds.length}
        </p>
        <Dialog>
          <DialogTrigger>
            <Button variant="ghost" size="sm" className="mt-3">
              View evidence
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{capability.name}</DialogTitle>
            </DialogHeader>
            <CapabilityEvidence evidence={capability.evidence} />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CapabilityCard;
