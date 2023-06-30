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

import { PrincipalType } from '../iam';
import { BaseConstruct } from '../core';

export interface PrivateRepositoryConfig extends EcrRepositoryConfig {}

export class PrivateRepository extends BaseConstruct {
  public repository: EcrRepository;
  public policy: EcrRepositoryPolicy;
  public policyDoc: DataAwsIamPolicyDocument;

  private id: string;
  private statements: DataAwsIamPolicyDocumentStatement[];

  constructor(scope: Construct, id: string, config: PrivateRepositoryConfig) {
    super(scope, id);

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

  removeResources(): void {
    this.node.tryRemoveChild(this.repository.id);
    this.node.tryRemoveChild(this.policy.id);
    this.node.tryRemoveChild(this.policyDoc.id);
  }
}
