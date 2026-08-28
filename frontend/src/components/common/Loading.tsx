import { Loader2Icon } from "lucide-react";

interface LoadingProps {
  label?: string;
}

const Loading = ({ label = "Loading..." }: LoadingProps) => {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
};

export default Loading;
