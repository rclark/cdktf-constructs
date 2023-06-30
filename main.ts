import { App, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';
import { EcrDockerLambda } from './lib/lambda/ecr-docker-lambda';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';

class Example extends TerraformStack {
  public lambda: EcrDockerLambda;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AwsProvider(this, 'aws', {});

    this.lambda = new EcrDockerLambda(this, `${id}-fn`, {
      functionName: 'example-function',
      gitsha: process.env.GITSHA,
      build: {
        dockerfile: 'Dockerfile',
        context: './',
      },
    });
  }
}

const app = new App();
const stack = new Example(app, 'example-stack');
app.synth();

if (process.env.BUILD) stack.lambda.build().catch((err) => console.error(err));
