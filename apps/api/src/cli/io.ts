export type Output = {
  log(message: string): void;
  error(message: string): void;
};

export type Prompt = {
  interactive: boolean;
  ask(question: string): Promise<string>;
};
