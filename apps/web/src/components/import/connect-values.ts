export type PlankaSignIn = "apiKey" | "password";

export type ImportConnectValues = {
  url: string;
  apiKey: string;
  token: string;
  username: string;
  password: string;
  plankaSignIn: PlankaSignIn;
};

export const EMPTY_CONNECT_VALUES: ImportConnectValues = {
  url: "",
  apiKey: "",
  token: "",
  username: "",
  password: "",
  plankaSignIn: "apiKey",
};
