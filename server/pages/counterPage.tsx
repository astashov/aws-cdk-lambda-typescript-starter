import React from "react";
import { Counter } from "../../client/components/counter";
import { Page } from "../page";
import { Renderer } from "../renderer";
import { Env } from "../utils/env";

export function renderCounterPage(counter: number): string {
  return Renderer.renderPage(<CounterPage counter={counter} />);
}

export function CounterPage(props: { counter: number }): JSX.Element {
  return (
    <Page
      title="The most simple counter ever"
      css={[`${Env.clientBaseUrl()}/counterPage`]}
      js={[`${Env.clientBaseUrl()}/counterPage`]}
      data={{ counter: props.counter }}
    >
      <Counter counter={props.counter} />
    </Page>
  );
}
