import ReactDom from "react-dom/server";

export class Renderer {
  public static renderPage(page: JSX.Element): string {
    return "<!DOCTYPE html>" + ReactDom.renderToString(page);
  }
}
