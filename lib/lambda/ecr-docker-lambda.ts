import { spawn } from 'child_process';
import { Construct } from 'constructs';
import { ECR } from '@aws-sdk/client-ecr';

import { DockerLambda, DockerLambdaConfig } from './docker-lambda';
import { PrivateRepository } from '../ecr';

export interface EcrDockerLambdaBuildConfig {
  dockerfile: string;
  context: string;
}

export interface EcrDockerLambdaConfig
  extends Omit<DockerLambdaConfig, 'imageUri'> {
  build: EcrDockerLambdaBuildConfig;
  gitsha?: string;
}

export class EcrDockerLambda extends DockerLambda {
  private repo: PrivateRepository;
  private static repoId = 'repo';
  private buildConfig: EcrDockerLambdaBuildConfig;
  private name: string;
  private gitsha?: string;

  constructor(scope: Construct, id: string, config: EcrDockerLambdaConfig) {
    const imageUri = '';
    super(scope, id, Object.assign({ imageUri }, config));

    this.buildConfig = config.build;
    this.name = config.functionName;
    this.gitsha = config.gitsha;

    this.repo = new PrivateRepository(this, EcrDockerLambda.repoId, {
      name: this.name,
    }).allowLambdaAccess();

    this.lambda.imageUri = `${this.repo.repository.repositoryUrl}:${config.gitsha}`;

    if (!config.gitsha) super.removeResources();
  }

  public async build(): Promise<void> {
    if (!this.gitsha) return;

    const ecr = new ECR({});
    const repos = await ecr.describeRepositories({
      repositoryNames: [this.name],
    });
    const uri = repos.repositories![0].repositoryUri!;
    const image = `${uri}:${this.gitsha}`;

    const auth = await ecr.getAuthorizationToken({});
    const token = Buffer.from(
      auth.authorizationData![0].authorizationToken!,
      'base64'
    )
      .toString()
      .split(':')[1];

    await run(
      'docker',
      'build',
      '-f',
      this.buildConfig.dockerfile,
      '-t',
      image,
      this.buildConfig.context
    );

    await run(
      'docker',
      'login',
      '--username',
      'AWS',
      '--password',
      token,
      uri.split('/')[0]
    );

    await run('docker', 'push', image);
  }

  removeResources(): void {
    super.removeResources();
    this.node.tryRemoveChild(EcrDockerLambda.repoId);
  }
}

async function run(cmd: string, ...args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(cmd, ...args);
    const p = spawn(cmd, args);

    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);

    p.on('error', reject);
    p.on('close', resolve);
  });
}
