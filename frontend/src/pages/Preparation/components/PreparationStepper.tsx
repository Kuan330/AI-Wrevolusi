import Stepper from "@/components/ui/stepper";

const steps = [
  { id: "s1", label: "Review evidence", done: true },
  { id: "s2", label: "Select priorities", done: true },
  { id: "s3", label: "Adjust effort", done: false },
  { id: "s4", label: "Confirm plan", done: false },
];

const PreparationStepper = () => {
  return <Stepper steps={steps} />;
};

export default PreparationStepper;
