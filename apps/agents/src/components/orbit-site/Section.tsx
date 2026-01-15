type SectionProps = {
  children?: React.ReactNode;
};

const Section = ({ children }: SectionProps) => {
  return <section className="w-full">{children}</section>;
};

export default Section;
