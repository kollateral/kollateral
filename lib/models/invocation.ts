import { AnyNumber } from "./const";

export interface Invocation {
  to: string;
  value: AnyNumber;
  data: string;
}

export interface Execution {
  contract: string;
  value?: AnyNumber;
  data?: string;
}