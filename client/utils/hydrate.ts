import {hydrate} from "react-dom";

export namespace HydrateUtils {
  export function hydratePage<T>(cb: (data: T) => JSX.Element): void {
    const escapedRawData = document.querySelector("#data")?.innerHTML || "{}";
    const parser = new DOMParser();
    const unescapedRawData = parser.parseFromString(escapedRawData, "text/html").documentElement.textContent || "{}";
    const data = JSON.parse(unescapedRawData) as T;
    hydrate(cb(data), document.getElementById("app")!);
  }
}
