import { Construct } from 'constructs';

export abstract class BaseConstruct extends Construct {
  abstract removeResources(): void;
}
