import { Construct } from 'constructs';
import { IamRole, IamRoleConfig } from '@cdktf/provider-aws/lib/iam-role';
import { DataAwsIamRole } from '@cdktf/provider-aws/lib/data-aws-iam-role';
import { TerraformMetaArguments } from 'cdktf';
import * as iam from 'iam-floyd';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';

import { BaseConstruct } from '../core';

export type Principal = {
  type: PrincipalType;
  identifiers: string[];
};

export enum PrincipalType {
  AWS = 'AWS',
  FEDERATED = 'Federated',
  CANONICAL_USER = 'CanonicalUser',
  SERVICE = 'Service',
}

export interface LimitedRoleConfig
  extends Omit<
    IamRoleConfig,
    'assumeRolePolicy' | 'name' | 'namePrefix' | 'inlinePolicy'
  > {}

export interface NewRoleConfig extends LimitedRoleConfig {
  name: string;
  principals: Principal[];
  policies?: iam.PolicyStatement[];
}

export interface ExistingRoleConfig extends TerraformMetaArguments {
  arn: string;
  policies?: iam.PolicyStatement[];
}

interface IRoleConfig extends TerraformMetaArguments {
  name?: string;
  arn?: string;
  policies?: iam.PolicyStatement[];
  principals?: Principal[];
}

export class Role extends BaseConstruct {
  private static externalId = 'external';
  private static newId = 'new';
  private static assumeId = 'assume';
  private static userId = 'user';

  public role: DataAwsIamRole | IamRole;
  public assumeRoleDoc?: DataAwsIamPolicyDocument;
  public userPolicy?: IamRolePolicy;

  constructor(scope: Construct, id: string, config: NewRoleConfig);
  constructor(scope: Construct, id: string, config: ExistingRoleConfig);
  constructor(scope: Construct, id: string, config: IRoleConfig) {
    super(scope, id);

    if (config.arn) {
      const [, name] = config.arn.split('/');

      this.role = new DataAwsIamRole(this, Role.externalId, { name });
    } else if (config.principals && config.name) {
      this.assumeRoleDoc = new DataAwsIamPolicyDocument(this, Role.assumeId, {
        statement: [
          {
            effect: 'Allow',
            actions: ['sts:AssumeRole'],
            principals: config.principals,
          },
        ],
      });

      this.role = new IamRole(this, Role.newId, {
        name: config.name,
        assumeRolePolicy: this.assumeRoleDoc.json,
      });
    } else {
      throw new Error(
        'Role must be provided either an arn or a name and principals list'
      );
    }

    if (config.policies) {
      const policy = {
        Version: '2012-10-17',
        Statement: config.policies,
      };

      this.userPolicy = new IamRolePolicy(this, Role.userId, {
        name: `user-permissions-${id}`,
        role: this.role.name,
        policy: JSON.stringify(policy),
      });
    }
  }

  removeResources(): void {
    this.node.tryRemoveChild(Role.externalId);
    this.node.tryRemoveChild(Role.newId);
    this.node.tryRemoveChild(Role.assumeId);
    this.node.tryRemoveChild(Role.userId);
  }
}
