import { Construct } from 'constructs';
import { TerraformMetaArguments } from 'cdktf';
import { PrincipalType, Role } from '../role';
import * as iam from 'iam-floyd';
import { DataAwsPartition } from '@cdktf/provider-aws/lib/data-aws-partition';

export interface ServiceRoleConfig extends TerraformMetaArguments {
  name: string;
  statement?: iam.PolicyStatement[];
  services: string[];
}

export class ServiceRole extends Role {
  constructor(scope: Construct, id: string, config: ServiceRoleConfig) {
    const partition = new DataAwsPartition(scope, id, config);

    const avoidSuffix = [
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
      const suffix = avoidSuffix.includes(prefix)
        ? 'amazonaws.com'
        : partition.dnsSuffix;
      return `${prefix}.${suffix}`;
    });

    super(scope, id, {
      name: config.name,
      principals: [{ type: PrincipalType.SERVICE, identifiers: principals }],
    });
  }
}
