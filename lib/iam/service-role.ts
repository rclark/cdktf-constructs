import { Construct } from 'constructs';
import * as iam from 'iam-floyd';
import { DataAwsPartition } from '@cdktf/provider-aws/lib/data-aws-partition';

import { LimitedRoleConfig, PrincipalType, Role } from './role';

export interface ServiceRoleConfig extends LimitedRoleConfig {
  name: string;
  statement?: iam.PolicyStatement[];
  services: string[];
}

export class ServiceRole extends Role {
  private static partitionId = 'partition';
  public partition: DataAwsPartition;

  constructor(scope: Construct, id: string, config: ServiceRoleConfig) {
    const partition = new DataAwsPartition(scope, `${id}-partition`, config);

    const noPartition = [
      'apigateway',
      'autoscaling',
      'cloudformation',
      'codedeploy',
      'ecs-tasks',
      'elasticbeanstalk',
      'firehose',
      'iot',
      'lambda',
      'rds',
      'redshift',
      's3',
      'sms',
      'storagegateway',
      'swf',
    ];

    const principals = config.services.map((value: string): string => {
      const prefix = value.replace(/\.amazonaws.com(\..*)?$/, '');
      const suffix = noPartition.includes(prefix)
        ? 'amazonaws.com'
        : partition.dnsSuffix;
      return `${prefix}.${suffix}`;
    });

    super(scope, id, {
      name: config.name,
      principals: [{ type: PrincipalType.SERVICE, identifiers: principals }],
    });

    this.partition = partition;
  }

  removeResources(): void {
    super.removeResources();
    this.node.tryRemoveChild(ServiceRole.partitionId);
  }
}
