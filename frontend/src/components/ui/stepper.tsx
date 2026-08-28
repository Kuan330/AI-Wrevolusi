interface Step {
  id: string;
  label: string;
  done: boolean;
}

interface StepperProps {
  steps: Step[];
}

const Stepper = ({ steps }: StepperProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-2">
          <div
            className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
              step.done
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {index + 1}
          </div>
          <span className="text-sm text-muted-foreground">{step.label}</span>
          {index < steps.length - 1 ? <span className="mx-1 h-px w-5 bg-border" /> : null}
        </div>
      ))}
    </div>
  );
};

export default Stepper;
