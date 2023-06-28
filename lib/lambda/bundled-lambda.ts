import { Construct } from 'constructs';
import { Lambda, LambdaConfig } from './lambda';

export interface BundledLambdaConfig
  extends Omit<
    LambdaConfig,
    'filename' | 'imageUri' | 'imageConfig' | 'packageType'
  > {
  s3Key: string;
  s3Bucket: string;
  runtime: string;
  handler: string;
}

export class BundledLambda extends Lambda {
  constructor(scope: Construct, id: string, config: BundledLambdaConfig) {
    super(scope, id, config);
  }
}
