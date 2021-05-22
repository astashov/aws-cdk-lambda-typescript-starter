import http from "http";
import {handler} from "./server/index";
import {APIGatewayProxyEvent, APIGatewayProxyEventHeaders} from "aws-lambda";
import {URL} from "url";
const {build} = require("./esbuild");
import childProcess from "child_process";

function getBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(data);
    });
  });
}

async function requestToProxyEvent(request: http.IncomingMessage): Promise<APIGatewayProxyEvent> {
  const body = await getBody(request);
  const url = new URL(request.url || "", "http://www.example.com");

  const qs: Partial<Record<string, string>> = {};
  url.searchParams.forEach((v, k) => {
    qs[k] = v;
  });
  return {
    body: body,
    headers: request.headers as APIGatewayProxyEventHeaders,
    multiValueHeaders: {},
    httpMethod: request.method || "GET",
    isBase64Encoded: false,
    path: url.pathname,
    pathParameters: {},
    queryStringParameters: qs,
    multiValueQueryStringParameters: {},
    stageVariables: {},
    requestContext: {} as any,
    resource: "",
  };
}

function proxyRequestToStatics(host: string, port: number, req: http.IncomingMessage, res: http.ServerResponse): void {
  const destUrl = new URL(req.url || "", "http://www.example.com");
  const path = destUrl.pathname.replace(/^\/static/, "");
  const url = new URL(`http://${host}:${port}${path}${destUrl.search}`);
  const request = http.request(
    {
      protocol: url.protocol,
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      search: url.search,
      headers: req.headers,
      method: req.method,
    },
    (response) => response.pipe(res)
  );
  request.end();
}

build(true, (host: string, port: number) => {
  console.log(`--------- Statics server is running, http://${host}:${port} ----------`);
  const server = http.createServer(async (req, res) => {
    try {
      const staticsPath = "static";
      const url = new URL(req.url || "", "http://www.example.com");
      if (url.pathname.startsWith(`/${staticsPath}/`)) {
        proxyRequestToStatics(host, port, req, res);
        return;
      }
      process.env.STATICS_PATH = `/${staticsPath}`;
      process.env.COMMIT_HASH = childProcess.execSync("git rev-parse --short HEAD").toString().trim();
      process.env.IS_DEV = "true";

      // CHANGEME: Specify the table names here (you'll see them after `npm run cdk-deploy`)
      process.env.TABLE_COUNTER = "ata-stack-dev-atacounterdev999BE8CE-ZYES46ICQRCN";

      const result = await handler(await requestToProxyEvent(req));
      const body = result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body;
      res.statusCode = result.statusCode;
      for (const k of Object.keys(result.headers || {})) {
        res.setHeader(k, result.headers![k] as string);
      }
      res.end(body);
    } catch (e) {
      console.error(e);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({name: e.name, error: e.message, stack: e.stack}));
    }
  });
  server.listen(3000, "localhost", () => {
    console.log(`--------- Main server is running, http://localhost:3000 ----------`);
  });
});
