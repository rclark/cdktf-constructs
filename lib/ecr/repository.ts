import { Construct } from 'constructs';
import {
  DataAwsIamPolicyDocument,
  DataAwsIamPolicyDocumentStatement,
} from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import {
  EcrRepository,
  EcrRepositoryConfig,
} from '@cdktf/provider-aws/lib/ecr-repository';
import { EcrRepositoryPolicy } from '@cdktf/provider-aws/lib/ecr-repository-policy';

import { ShareableMeta } from '../shareable-meta';
import { PrincipalType } from '../iam';

export interface PrivateRepositoryConfig extends EcrRepositoryConfig {}

export class PrivateRepository extends ShareableMeta {
  public repository: EcrRepository;
  public policy: EcrRepositoryPolicy;
  public policyDoc: DataAwsIamPolicyDocument;

  private id: string;
  private statements: DataAwsIamPolicyDocumentStatement[];

  constructor(scope: Construct, id: string, config: PrivateRepositoryConfig) {
    super(scope, id, config);

    this.id = id;
    this.statements = [];

    this.repository = new EcrRepository(this, id, config);

    this.policyDoc = new DataAwsIamPolicyDocument(this, `${this.id}-doc`, {});

    this.policy = new EcrRepositoryPolicy(this, `${this.id}-policy`, {
      repository: this.repository.name,
      policy: this.policyDoc.json,
    });
  }

  public allowLambdaAccess(): PrivateRepository {
    this.statements.push({
      effect: 'Allow',
      actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      principals: [
        { type: PrincipalType.SERVICE, identifiers: ['lambda.amazonaws.com'] },
      ],
    });

    this.policyDoc.putStatement(this.statements);

    return this;
  }
}
