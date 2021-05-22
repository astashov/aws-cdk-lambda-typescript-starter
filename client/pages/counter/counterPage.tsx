import React from "react";
import { Counter } from "../../components/counter";
import { HydrateUtils } from "../../utils/hydrate";

interface ICounterPageData {
  counter: number;
}
HydrateUtils.hydratePage<ICounterPageData>((data) => <Counter counter={data.counter} />);
