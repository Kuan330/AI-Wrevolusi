import Timeline from "@/components/ui/timeline";

const events = [
  { id: "t1", title: "Task selected", detail: "Email triage", time: "Week 1" },
  { id: "t2", title: "Tool introduced", detail: "Prompt templates", time: "Week 2" },
  { id: "t3", title: "Time reduced", detail: "-20 minutes per day", time: "Week 4" },
];

const EfficiencyTimeline = () => {
  return <Timeline items={events} />;
};

export default EfficiencyTimeline;
