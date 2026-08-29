import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExposureCardProps {
  title: string;
  state: string;
  reason: string;
  confidence?: number;
}

const ExposureCard = ({ title, state, reason, confidence }: ExposureCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-primary">{state}</p>
          {typeof confidence === "number" ? (
            <Badge variant="outline">{Math.round(confidence * 100)}%</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  );
};

export default ExposureCard;
