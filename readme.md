# cdk-constructs

An adventure in learning the terraform CDK.

## Goal

Build a few composable CDKTF constructs that could help an application developer get an AWS Lambda function off the ground. Ultimately, the CDK script is at [main.ts](./main.ts).

## Bootstrapping

I focused on bootstrapping a Lambda function that is backed by Docker images stored in ECR. I was able to consolidate both the build and deploy steps in a CDKTF construct [ecr-docker-lambda.ts](./lib/lambda/ecr-docker-lambda.ts).

In [package.json](./package.json), a script runs that will use the CDK to establish an ECR repository that the Lambda service is allowed to read from.

```json
    "first-time-setup": "cdktf deploy",
```

## Build

Usually, builds would be performed on some controlled infrastructure layer, as part of a CI process. Again, [package.json](./package.json) provides a script that could be used to run that build. This builds the Dockerfile and uploads it to ECR.

```json
    "build-lambda": "BUILD=1 GITSHA=$(git rev-parse HEAD) ts-node main.ts",
```

It is actually running the same CDK script that would be used to deploy, but just without relying on the CDK CLI tool to perform any deployment steps.

## Deploy

When there's new code ready in ECR to be launched on the Lambda function, another [package.json](./package.json) script provides the routine to update the infrastructure.

```json
    "deploy-lambda": "GITSHA=$(git rev-parse HEAD) cdktf deploy"
```
