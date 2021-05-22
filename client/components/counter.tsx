import React from "react";

export function Counter(props: {counter: number}): JSX.Element {
  const [value, setValue] = React.useState(props.counter);

  return <div>
    <h1>Counter!</h1>
    <div><span>Value: </span><span>{value}</span></div>
    <div><button onClick={() => {
      window.fetch(`/increment/${value + 1}`, {method: "POST"});
      setValue(value + 1);
    }}>Increment</button></div>
  </div>;
}
