type SlotProps<T extends React.ElementType> = {
  as: T;
} & React.ComponentPropsWithRef<T>;

export const Slot = <T extends React.ElementType>({
  as,
  children,
  ...props
}: SlotProps<T>) => {
  const Component = as;
  return <Component {...props}>{children}</Component>;
};
