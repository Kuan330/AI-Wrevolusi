interface CapabilityEvidenceProps {
  evidence: string[];
}

const CapabilityEvidence = ({ evidence }: CapabilityEvidenceProps) => {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      {evidence.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

export default CapabilityEvidence;
