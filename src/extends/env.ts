export interface IProcessEnv {
  TOKEN: string;

  CHANNEL_A: string;
  CHANNEL_B: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends IProcessEnv { }
  }
}