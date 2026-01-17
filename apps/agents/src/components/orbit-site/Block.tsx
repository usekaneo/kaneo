type BlockProps = {
  children: React.ReactNode;
  title?: string;
};

const Block = ({ children, title }: BlockProps) => {
  return (
    <>
      {title && (
        <header>
          <h2 className="mt-10 mb-4 text-2xl font-bold tracking-tight">
            {title}
          </h2>
        </header>
      )}
      <div className="flex aspect-video w-full items-center justify-center gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-10 transition-colors dark:border-neutral-800 dark:bg-neutral-950">
        {children}
      </div>
    </>
  );
};

export default Block;
