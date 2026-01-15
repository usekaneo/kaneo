import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  children?: React.ReactNode;
  className?: string;
  isValid?: boolean;
  title: string;
  required?: boolean;
  requiredDescription?: string;
};

export const Label = ({
  children,
  className,
  isValid,
  title,
  htmlFor,
  required,
  requiredDescription,
  ...props
}: LabelProps) => {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-ob-base-200 relative block w-full items-center gap-1 text-sm transition-colors *:w-full",
        className
      )}
      {...props}
    >
      <div className="mb-1 flex w-max">
        {title}
        {required && (
          <>
            <span className="ml-0.5 inline-block">*</span>
            {requiredDescription && !isValid && (
              <span className="text-ob-destructive ml-1 inline-block transition-colors">
                {requiredDescription}
              </span>
            )}
          </>
        )}
      </div>
      {children}
    </label>
  );
};
