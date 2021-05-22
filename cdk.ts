import * as cdk from "@aws-cdk/core";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as lambda from "@aws-cdk/aws-lambda";
import * as apigw from "@aws-cdk/aws-apigateway";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3Deployment from "@aws-cdk/aws-s3-deployment";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import * as acm from "@aws-cdk/aws-certificatemanager";
import * as route53 from "@aws-cdk/aws-route53";
import * as targets from "@aws-cdk/aws-route53-targets";
import childProcess from "child_process";

const commitHash = childProcess.execSync("git rev-parse --short HEAD").toString().trim();

interface IOptions {
  appname: string;
  hostedZoneId?: string;
  domainName?: string;
  certificateArn?: string;
}

// CHANGEME: please change those to the values for your app. The only required attr is `appname`, which will
// be a prefix for the stack's resources names. If you want to add your own domain, also specify `hostedZoneId`,
// `domainName` and `certificateArn`.
const options: IOptions = {
  appname: "ata",
  hostedZoneId: "Z07651032A824JHZBXG0D",
  domainName: "aws-typescript-app.com",
  certificateArn: "arn:aws:acm:us-east-1:547433167554:certificate/a63e8bf4-c075-4068-8be9-f1f1a3acb755",
};
// END

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, isDev: boolean, props?: cdk.StackProps) {
    super(scope, id, props);
    const env = isDev ? "dev" : "prod";
    const {appname, hostedZoneId, domainName, certificateArn} = options;

    const domain = domainName != null ? `${isDev ? "dev." : ""}${domainName}` : undefined;
    const staticsPath = "static";

    // Preparing a layer for lambda, that will include only `package.json`, `package-lock.json` and `node_modules`
    // This way, our lambda size will be smaller, since all the dependencies will be moved to the layer,
    // and the lambda itself will only contain the app source code
    const depsLayer = new lambda.LayerVersion(this, `${appname}-node-dependencies-${env}`, {
      code: lambda.Code.fromAsset("dist-server", {
        bundling: {
          image: lambda.Runtime.NODEJS_14_X.bundlingImage,
          command: [
            "bash",
            "-c",
            "mkdir -p /asset-output/nodejs && cd /asset-output/nodejs && cp /asset-input/{package.json,package-lock.json} . && npm ci",
          ],
          environment: {HOME: "/tmp/home"},
        },
      }),
    });

    // Create DynamoDB tables
    const counterTable = new dynamodb.Table(this, `${appname}-counter-${env}`, {
      partitionKey: {name: "key", type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
    });

    // Create S3 bucket where we will store the statics - JS and CSS bundles
    const bucket = new s3.Bucket(this, `${appname}-s3-${env}`, {
      bucketName: `${appname}-s3-bucket-${env}`,
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true,
    });

    // Deploy the statics (CSS and JS bundles) to our S3 bucket
    new s3Deployment.BucketDeployment(this, `${appname}-deploy-static-website-${env}`, {
      sources: [s3Deployment.Source.asset("dist")],
      destinationKeyPrefix: staticsPath,
      destinationBucket: bucket,
    });

    // Create the lambda function, that will work as our server
    // We pass all the table names as environment variables to the lambda
    const lambdaFunction = new lambda.Function(this, `${appname}-lambda-${env}`, {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("dist-server"),
      memorySize: 2048,
      layers: [depsLayer],
      timeout: cdk.Duration.seconds(isDev ? 120 : 10),
      handler: "server/index.handler",
      environment: {
        IS_DEV: `${isDev}`,
        STATICS_PATH: `/${staticsPath}`,
        COMMIT_HASH: commitHash,
        // Pass all the table names here
        TABLE_COUNTER: counterTable.tableName,
      },
    });
    bucket.grantReadWrite(lambdaFunction);
    counterTable.grantReadWriteData(lambdaFunction);

    // Get the certificate for our domain. You'll need to create it via AWS console separately, and then
    // specify it's ARN in `options` object above.
    const cert =
      certificateArn != null
        ? acm.Certificate.fromCertificateArn(this, `${appname}-certificate-${env}`, certificateArn)
        : undefined;

    // Create API Gateway to access our lambda via HTTP
    const restApi = new apigw.RestApi(this, `${appname}-endpoint-${env}`, {
      defaultIntegration: new apigw.LambdaIntegration(lambdaFunction),
      binaryMediaTypes: ["*/*"],
    });
    restApi.root.addProxy();

    // Cloudfront distribution that will accept all the requests from a browser. This is our entrypoint
    // into the application. By default it will proxy the call to the API Gateway (which will proxy it to Lambda),
    // but for /static/* paths it will proxy the call to S3 with our CSS/JS bundles.
    const cloudfrontDistribution = new cloudfront.Distribution(this, `${appname}-cloudfront-${env}`, {
      certificate: cert,
      domainNames: domain != null ? [domain] : undefined,
      defaultBehavior: {
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        origin: new origins.HttpOrigin(cdk.Fn.parseDomainName(restApi.url), {originPath: "/prod"}),
      },
      additionalBehaviors: {
        [`/${staticsPath}/*`]: {
          origin: new origins.S3Origin(bucket),
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });

    // In case you specify the domain name and hosted zone in `options` variable above, we add the A DNS
    // records that will point to our entrypoint cloudfront distribution
    if (hostedZoneId != null && domain != null) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, `${appname}-hosted-zone-${env}`, {
        hostedZoneId: hostedZoneId,
        zoneName: domain,
      });

      new route53.ARecord(this, `${appname}-a-record-${env}`, {
        zone: zone,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(cloudfrontDistribution)),
      });
    }

    // Display the table names and the domain name of the cloudfront distribution
    new cdk.CfnOutput(this, `${appname}-table-name-counter-${env}`, {value: counterTable.tableName});
    new cdk.CfnOutput(this, `${appname}-domain-${env}`, {
      value: domainName || cloudfrontDistribution.distributionDomainName,
    });
  }
}

const app = new cdk.App();
new CdkStack(app, `${options.appname}-stack-dev`, true);
new CdkStack(app, `${options.appname}-stack-prod`, false);
