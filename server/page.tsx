import React from "react";

interface IProps<T> {
  title: string;
  css: string[];
  js: string[];
  data: T;
  children?: React.ReactNode;
}

export function Page<T>(props: IProps<T>): JSX.Element {
  return (
    <html lang="en">
      <head>
        <title>{props.title}</title>
        {props.css.map((c) => (
          <link key={c} rel="stylesheet" type="text/css" href={`${c}.css?version=${process.env.COMMIT_HASH}`} />
        ))}
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div id="app">
          {props.children}
        </div>
        <div id="data" style={{ display: "none" }}>
          {JSON.stringify(props.data)}
        </div>
        {props.js.map((js) => (
          <script key={js} src={`${js}.js?version=${process.env.COMMIT_HASH}`}></script>
        ))}
      </body>
    </html>
  );
}