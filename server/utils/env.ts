export type IEnv = "dev" | "prod";

export namespace Env {
  export function get(): IEnv {
    return process.env.IS_DEV === "true" ? "dev" : "prod";
  }

  export function clientBaseUrl(): string {
    return process.env.STATICS_PATH || "/";
  }
}
