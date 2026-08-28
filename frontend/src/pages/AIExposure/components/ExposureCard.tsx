import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExposureCardProps {
  title: string;
  state: string;
  reason: string;
}

const ExposureCard = ({ title, state, reason }: ExposureCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-primary">{state}</p>
        <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  );
};

export default ExposureCard;
