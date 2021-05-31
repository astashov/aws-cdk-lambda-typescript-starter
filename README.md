# AWS CDK TypeScript skeleton starter with Lambda and DynamoDB

This is a skeleton starter of a server-side rendered TypeScript React app, running on AWS Lambda and using DynamoDB as a database. It's a simple counter that stores its value in DynamoDB.

Demo:

- Production Environment: https://aws-typescript-app.com
- Development Environment: https://dev.aws-typescript-app.com

Features:

- Server side rendered template, easy to add more pages
- All the necessary AWS services and deployment is done via AWS CDK, contained in just one file [`cdk.ts`](cdk.ts).
- Fast and simple local server, that allows to develop Lambda server locally. It watches the changes and restarts on change.
- One server both for statics and the app code.
- Cheap - costs less than $5 per month to run all of that in AWS.
- All the goodies that AWS provides - monitoring, logging, database backups every second.
- Serving the statics (CSS and JS bundles) from the same domain as the HTML, so you don't have to deal with crossdomain issues (for example, errors will be handled propery by `window.onerror`).
- If you buy a domain via Route53 and a certificate via Amazon Certificate Manager, it's very easy to add them to this skeleton.
- Easy to add any other AWS service/feature - emails, queues, you name it.
- 2 environments out of the box - Production and Development

# How to use

In AWS, you'll need a user with the following permission policies added (you can add it in AWS IAM):

- AmazonS3FullAccess
- CloudFrontFullAccess
- AmazonAPIGatewayAdministrator
- AmazonRoute53FullAccess
- AWSCloudFormationFullAccess
- AWSLambda_FullAccess

Put `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` of that user into the environment variables (you may want to add those to your ~/.profile or ~/.bashrc or something).

Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) and [CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install)

Clone this repo, then run `npm ci` to install dependencies.

Then, search for the `CHANGEME` strings in the codebase and replace those values with your values. At the minimum, you should probably specify the app name in [`cdk.ts`](cdk.ts) (i.e. replace `ata` with something more meaningful :)).

Then, run:

```bash
$ npm run cdk-deploy
```

to deploy it to AWS. It will deploy both to Dev and Prod environments, first to Dev, then to Prod. It will output the URL you can access the site, and also the table name after deploying to Dev and Prod. You can try it out by visiting that URL. Also, copy the table name that was displayed after deploying the Dev environment, and paste it in [`devserver.ts`](devserver.ts) where `CHANGEME` is for the table names.

Now, you can run it locally. Run

```bash
$ npm start
```

and visit http://localhost:3000. You should be able to see the counter. If you increase counter, the new value will be stored in DynamoDB, and will be loaded from there next time you visit the page.

# How it works

### CDK

There's [`cdk.ts`](cdk.ts) file, that describes the whole infrastructure we use to run our app, including:

- Lambda that runs our application server with one layer for `node_modules`.
- DynamoDB that stores the counter value
- S3 bucket for storing CSS and JS bundles
- Gateway API for the lambda
- Cloudfront CDN, that proxies the requests to the S3 bucket and to the Lambda
- (Optionally) DNS records and certificate for the custom domain for the app.

The diagram of those services could look something like this:

```
              +--------------+           +-------------+     +-----------+    +-----------+
              |              | any other |             |     |           |    |           |
 User Request | Cloudfront   | path      | Gateway API |     |  Lambda   |    | DynamoDB  |
 ------------>| distribution +---------->|             +---->|           +--->|           |
              |              |           +-------------+     +-----------+    +-----------+
              +-------|------+
                      |
                      |                  +-------------+
                      |                  |             |
                      |                  | S3 bucket   |
                      +----------------->| with JS/CSS |
                          /statics/*     |             |
                                         +-------------+
```

So, Cloudfront distribution will proxy `/statics/*` requests to the S3 bucket for CSS/JS bundles, and any other request would be proxied to the lambda.

[`cdk.ts`](cdk.ts) defines that infrastructure in 2 environments - Prod and Dev. There will be 2 different Cloudformation stacks, and each will have each own copy of a cloudfront distrubution, s3 bucket, gateway API, lambda and dynamodb.

To build CSS and JS bundles we use `esbuild`, it's maybe not as featureful as Webpack, but it's pretty simple and also blazing fast, and compiles our bundles within a second. The configuration is in `esbuild.js`.

### Local

For local development, we use regular Node http server, for running the server, and we use `esbuild`'s `serve` API to run a server that serves the CSS and JS bundles. To run the local server, use `npm start` command. It will run and watch [`devserver.ts`](devserver.ts), and if any files that it imports changes, it will restart the server.

[`devserver.ts`](devserver.ts) internally will start `esbuild`'s server first, and then it will start Node's `http` server. Then, if the request path is `/statics/*`, it will proxy it to the `esbuild`'s static server. Otherwise, it will convert the `http`'s request object (`http.IncomingMessage`) into the Lambda's `APIGatewayProxyEvent`, and then will call the lambda entrypoint function with that `APIGatewayProxyEvent` as an argument. Lambda entrypoint will return `APIGatewayProxyResult` result, which `devserver.ts` will parse and convert into `http.ServerResponse` response.

So, it serves both CSS/JS bundles and the HTML itself from the same domain - this is IMHO very convenient because then you don't need to handle CORS issues.

### App

The entrypoint into the app is [`server/index.ts`](server/index.ts), both locally and for lambda. There, we define a router, and various router handlers. The incoming request will be feed into the router, will return the response from one of the route handlers.

We use server-side rendering, so the route handlers that render HTML, call the pages components defined in `src/pages/`. Page components are regular React components, but they render special `<Page>` component. That `<Page>` component defines the HTML basic structure (`<head>`, `<body>`, the data we pass to the client, imports of CSS/JS bundles, etc).

The client counter-part of the page lives in `client/pages/`. There will code that rehydrates the page with the same component and data that we used on the server.

Check [`server/pages/counterPage.tsx`](server/pages/counterPage.tsx) and [`client/pages/counterPage.tsx`](client/pages/counterPage.tsx) for an example.

# Add a custom domain

You can easily add a custom domain to this app, if you purchase it via Route53. Then, all the DNS setup and attaching the domain to the cloudfront distrubution could be done via CDK as well.

1. Go to AWS Route 53, and purchase a domain name there. That will create a Hosting Zone in Route 53. Copy the domain namd and the Hosting Zone ID to `cdk.ts`, to `CHANGEME` section.
2. Go to AWS Certificates Manager, and create a public certificate, for domains `your-domain.com` and `*.your-domain.com`. MAKE SURE YOU CREATE IT IN `us-east-1` ZONE! This is important, because AWS Cloudfront distributions only support certificates in that zone. After creation, copy its ARN to `cdk.ts`, to `CHANGEME` section.

Now, run:

```bash
$ npm run cdk-deploy
```

and that's it. That should attach that new domain to your app. You'll be able to access the Production version by `your-domain.com`, and the Development version by `dev.your-domain.com`.
