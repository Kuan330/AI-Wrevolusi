import PageHeader from "@/components/common/PageHeader";
import InterpretationPanel from "@/pages/Interpretation/components/InterpretationPanel";

const Interpretation = () => {
  return (
    <div>
      <PageHeader
        title="Interpretation & Review (E4)"
        description="Keep explanations clear and allow corrections before results flow downstream."
      />
      <InterpretationPanel />
    </div>
  );
};

export default Interpretation;
