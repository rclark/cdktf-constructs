import { Construct } from 'constructs';
import { Lambda, LambdaConfig } from './lambda';

export interface DockerLambdaConfig
  extends Omit<
    LambdaConfig,
    | 'filename'
    | 'handler'
    | 'imageUri'
    | 'packageType'
    | 'runtime'
    | 's3Key'
    | 's3Bucket'
    | 's3ObjectVersion'
    | 'snapStart'
    | 'sourceCodeHash'
  > {
  imageUri: string;
}

export class DockerLambda extends Lambda {
  constructor(scope: Construct, id: string, config: DockerLambdaConfig) {
    super(scope, id, config);

    this.lambda.imageUri = config.imageUri;
    this.lambda.packageType = 'Image';
  }
}
