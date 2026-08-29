import PageHeader from "@/components/common/PageHeader";
import { mockCapabilities } from "@/data/capabilities";
import CapabilityCard from "@/pages/Capabilities/components/CapabilityCard";

const Capabilities = () => {
  return (
    <div>
      <PageHeader
        title="Capabilities (E3)"
        description="Translate confirmed tasks into capability evidence and evolution guidance."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {mockCapabilities.map((capability) => (
          <CapabilityCard key={capability.id} capability={capability} />
        ))}
      </div>
    </div>
  );
};

export default Capabilities;
