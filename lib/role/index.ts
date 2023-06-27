import { Construct } from 'constructs';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { DataAwsIamRole } from '@cdktf/provider-aws/lib/data-aws-iam-role';
import { TerraformMetaArguments } from 'cdktf';
import * as iam from 'iam-floyd';
import { ShareableMeta } from '../shareable-meta';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';

export type Principal = {
  type: PrincipalType;
  identifiers: string[];
};

export declare enum PrincipalType {
  AWS = 'AWS',
  FEDERATED = 'Federated',
  CANONICAL_USER = 'CanonicalUser',
  SERVICE = 'Service',
}

export interface NewRoleConfig extends TerraformMetaArguments {
  name: string;
  statement?: iam.PolicyStatement[];
  principals: Principal[];
}

export interface ExistingRoleConfig extends TerraformMetaArguments {
  arn: string;
  statement?: iam.PolicyStatement[];
}

export interface IRoleConfig extends TerraformMetaArguments {
  name?: string;
  arn?: string;
  statement?: iam.PolicyStatement[];
  principals?: Principal[];
}

export class Role extends ShareableMeta {
  public role: DataAwsIamRole | IamRole;

  constructor(scope: Construct, id: string, config: NewRoleConfig);
  constructor(scope: Construct, id: string, config: ExistingRoleConfig);
  constructor(scope: Construct, id: string, config: IRoleConfig) {
    super(scope, id, config);

    if (config.arn) {
      const [, name] = config.arn.split('/');

      this.role = new DataAwsIamRole(
        this,
        `${id}-external-role`,
        this.sharedMeta({ name })
      );
    } else if (config.principals) {
      const assume = new DataAwsIamPolicyDocument(
        this,
        `${id}-assume`,
        this.sharedMeta({
          statement: [
            {
              effect: 'Allow',
              actions: ['sts:AssumeRole'],
              principals: config.principals,
            },
          ],
        })
      );

      this.role = new IamRole(
        this,
        `${id}-role`,
        this.sharedMeta({
          name: `lambda-role-${id}`,
          assumeRolePolicy: assume.json,
        })
      );
    } else {
      throw new Error('Role must be provided either a name or principals list');
    }

    if (config.statement) {
      const policy = {
        Version: '2012-10-17',
        Statement: config.statement,
      };

      new IamRolePolicy(
        this,
        `${id}-user-policy`,
        this.sharedMeta({
          name: `user-permissions-${id}`,
          role: this.role.arn,
          policy: JSON.stringify(policy),
        })
      );
    }
  }
}
