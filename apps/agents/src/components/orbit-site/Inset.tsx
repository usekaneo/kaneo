type InsetProps = {
  children?: React.ReactNode;
};

const Inset = ({ children }: InsetProps) => {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pt-10 pb-40">
      {children}
    </div>
  );
};

export default Inset;
