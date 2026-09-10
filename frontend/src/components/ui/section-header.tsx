interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

const SectionHeader = (props: SectionHeaderProps) => {
  const { title, subtitle } = props;
  return (
    <>
      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">{subtitle}</p>
    </>
  );
};

export default SectionHeader;
