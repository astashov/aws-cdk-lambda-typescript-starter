import {DynamoDB} from "aws-sdk";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {Endpoint, Method, Router, RouteHandler, Either} from "yatro";
import {renderCounterPage} from "./pages/counterPage";
import {LogUtil} from "./utils/log";

interface IPayload {
  event: APIGatewayProxyEvent;
}

const counterEndpoint = Endpoint.build("/");
const counterHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof counterEndpoint> = async () => {
  const dynamo = new DynamoDB.DocumentClient();
  const result = await dynamo
    .get({
      TableName: process.env.TABLE_COUNTER!,
      Key: {key: "mycounter"},
    })
    .promise();

  return {statusCode: 200, body: renderCounterPage(result.Item?.value || 1), headers: {"Content-Type": "text/html"}};
};

const incrementEndpoint = Endpoint.build("/increment/:value|i");
const incrementHandler: RouteHandler<IPayload, APIGatewayProxyResult, typeof incrementEndpoint> = async ({
  match: {params},
}) => {
  const dynamo = new DynamoDB.DocumentClient();
  await dynamo
    .put({
      TableName: process.env.TABLE_COUNTER!,
      Item: {key: "mycounter", value: params.value},
    })
    .promise();
  return {statusCode: 200, body: JSON.stringify({value: params.value})};
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const log = new LogUtil();
  const time = Date.now();
  log.log("--------> Starting request", event.httpMethod, event.path);

  const request: IPayload = {event};
  const router = new Router<IPayload, APIGatewayProxyResult>(request)
    .get(counterEndpoint, counterHandler)
    .post(incrementEndpoint, incrementHandler);

  const url = new URL(event.path, "http://example.com");
  for (const key of Object.keys(event.queryStringParameters || {})) {
    const value = (event.queryStringParameters || {})[key];
    url.searchParams.set(key, value || "");
  }
  let resp: Either<APIGatewayProxyResult>;
  try {
    resp = await router.route(event.httpMethod as Method, url.pathname + url.search);
  } catch (e) {
    console.error(e);
    log.log("<-------- Responding for", event.httpMethod, event.path, 500, `${Date.now() - time}ms`);
    return {statusCode: 500, body: "Internal Server Error"};
  }

  log.log(
    "<-------- Responding for",
    event.httpMethod,
    event.path,
    resp.success ? resp.data.statusCode : 404,
    `${Date.now() - time}ms`
  );

  return resp.success ? resp.data : {statusCode: 404, body: "Not Found"};
};
