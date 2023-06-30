import { Construct } from 'constructs';
import { ITerraformDependable } from 'cdktf';
import {
  LambdaFunction,
  LambdaFunctionConfig,
  LambdaFunctionVpcConfig,
} from '@cdktf/provider-aws/lib/lambda-function';
import {
  CloudwatchLogGroup,
  CloudwatchLogGroupConfig,
} from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import {
  CloudwatchMetricAlarm,
  CloudwatchMetricAlarmConfig,
} from '@cdktf/provider-aws/lib/cloudwatch-metric-alarm';
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { DataAwsIamRole } from '@cdktf/provider-aws/lib/data-aws-iam-role';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { DataAwsRegion } from '@cdktf/provider-aws/lib/data-aws-region';
import * as iam from 'iam-floyd';

import { Role, ServiceRole } from '../iam';
import { DataAwsSubnetIds } from '@cdktf/provider-aws/lib/data-aws-subnet-ids';
import { DataAwsSecurityGroups } from '@cdktf/provider-aws/lib/data-aws-security-groups';
import { DataAwsVpc } from '@cdktf/provider-aws/lib/data-aws-vpc';
import { BaseConstruct } from '../core';

export interface LambdaRoleConfig {
  arn?: string;
  policies?: iam.PolicyStatement[];
}

export interface LambdaConfig
  extends Omit<LambdaFunctionConfig, 'role' | 'vpcConfig'> {
  logGroup?: Omit<CloudwatchLogGroupConfig, 'name' | 'namePrefix'>;
  role?: LambdaRoleConfig;
  alarm?: LambdaAlarmConfig;
}

export enum MetricStatistic {
  COUNT = 'SampleCount',
  AVG = 'Average',
  SUM = 'Sum',
  MIN = 'Minimum',
  MAX = 'Maximum',
}

export interface LambdaAlarmConfig
  extends Partial<
    Omit<
      CloudwatchMetricAlarmConfig,
      | 'alarmName'
      | 'alarmDescription'
      | 'namespace'
      | 'dimensions'
      | 'metricName'
      | 'statistic'
      | 'unit'
      | 'extendedStatistic'
      | 'evaluateLowSampleCountPercentiles'
      | 'metricQuery'
      | 'thresholdMetricId'
    >
  > {
  statistic?: MetricStatistic;
}

export interface LambdaVpcConfig extends Partial<LambdaFunctionVpcConfig> {
  vpcId?: string;
}

export class Lambda extends BaseConstruct {
  public static functionDefaults: Partial<LambdaFunctionConfig> = {
    memorySize: 128,
    timeout: 300,
  };

  public static alarmDefaults: Partial<CloudwatchMetricAlarmConfig> = {
    alarmActions: [],
    period: 60,
    statistic: MetricStatistic.SUM,
    datapointsToAlarm: 1,
    threshold: 0,
    comparisonOperator: 'GreaterThanThreshold',
    treatMissingData: 'notBreaching',
  };

  public static logGroupDefaults: Partial<CloudwatchLogGroupConfig> = {
    retentionInDays: 14,
  };

  private static fnId = 'fn';
  private static logId = 'logs';
  private static alarmId = 'alarm';
  private static regionId = 'region';
  private static logDocId = 'log-doc';
  private static policyId = 'policy';
  private static roleId = 'role';
  private static vpcId = 'vpc';
  private static subnetId = 'subnets';
  private static sgId = 'sgs';

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id);

    this.functionName = config.functionName;
    this.region = new DataAwsRegion(scope, Lambda.regionId);

    this.buildRole(config.role);

    this.logGroup = new CloudwatchLogGroup(
      this,
      Lambda.logId,
      this.logCfg(config)
    );

    this.lambda = new LambdaFunction(this, Lambda.fnId, this.lambdaCfg(config));

    this.alarm = new CloudwatchMetricAlarm(
      this,
      Lambda.alarmId,
      this.alarmCfg(config)
    );
  }

  public lambda: LambdaFunction;
  public alarm: CloudwatchMetricAlarm;
  public loggingPermissionsDoc!: DataAwsIamPolicyDocument;
  public loggingPolicy!: IamRolePolicy;
  public vpc?: DataAwsVpc;
  public subnets?: DataAwsSubnetIds;
  public sgs?: DataAwsSecurityGroups;

  private set logGroup(group: CloudwatchLogGroup) {
    this.loggingPermissionsDoc = new DataAwsIamPolicyDocument(
      this,
      Lambda.logDocId,
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['logs:*'],
            resources: [group.arn],
          },
        ],
      }
    );

    this.loggingPolicy = new IamRolePolicy(this, Lambda.policyId, {
      name: `lambda-logging-${this.functionName}`,
      role: this.role.name,
      policy: this.loggingPermissionsDoc.json,
    });

    this._logGroup = group;
  }

  public get logGroup(): CloudwatchLogGroup {
    return this._logGroup;
  }

  private functionName: string;
  private region: DataAwsRegion;
  private _logGroup!: CloudwatchLogGroup;
  private _role!: Role;

  public get role(): DataAwsIamRole | IamRole {
    return this._role.role;
  }

  public inVPC(config?: LambdaVpcConfig): Lambda {
    let { subnetIds, securityGroupIds, vpcId } = config || {};

    if (!config) {
      this.vpc = new DataAwsVpc(this, Lambda.vpcId, {});
      vpcId = this.vpc.id;
    }

    if (vpcId) {
      this.subnets = new DataAwsSubnetIds(this, Lambda.subnetId, {
        vpcId: vpcId,
      });
      subnetIds = subnetIds || this.subnets.ids;

      this.sgs = new DataAwsSecurityGroups(this, Lambda.sgId, {
        filter: [{ name: 'vpc-id', values: [vpcId] }],
      });
      securityGroupIds = securityGroupIds || this.sgs.ids;
    }

    if (!subnetIds || !securityGroupIds) {
      throw new Error(
        'Must supply either no vpc config, a vpcId, or both subnetIds and securityGroupIds'
      );
    }

    this.lambda.putVpcConfig({ subnetIds, securityGroupIds });
    return this;
  }

  private buildRole(config: LambdaRoleConfig | undefined) {
    if (config && config.arn) {
      const existing = new Role(this, Lambda.roleId, {
        arn: config.arn,
        policies: config.policies,
      });
      this._role = existing;
      return;
    }

    const newRole = new ServiceRole(this, Lambda.roleId, {
      name: `lambda-role-${this.functionName}`,
      statement: config ? config.policies : [],
      services: ['lambda'],
    });
    this._role = newRole;
  }

  private lambdaCfg(config: LambdaConfig): LambdaFunctionConfig {
    let depends = [this.logGroup as ITerraformDependable];
    if (config.dependsOn) depends = depends.concat(config.dependsOn);

    const required: LambdaFunctionConfig = {
      dependsOn: depends,
      functionName: this.functionName,
      role: this.role.arn,
    };

    return Object.assign({}, Lambda.functionDefaults, config, required);
  }

  private alarmCfg(config: LambdaConfig): CloudwatchMetricAlarmConfig {
    const required: Partial<CloudwatchMetricAlarmConfig> = {
      alarmName: `lambda-errors-${this.functionName}-${this.region.name}`,
      alarmDescription: `Error alarm for the ${this.functionName} Lambda function`,
      namespace: 'AWS/Lambda',
      dimensions: { FunctionName: this.functionName },
      metricName: 'Errors',
    };

    const intermediate = Object.assign(
      {},
      Lambda.alarmDefaults,
      config.alarm,
      required
    );

    const evaluationPeriods = Math.ceil(
      this.lambdaCfg(config).timeout! / intermediate.period!
    );

    return Object.assign(
      { evaluationPeriods },
      intermediate
    ) as CloudwatchMetricAlarmConfig;
  }

  private logCfg(config: LambdaConfig): CloudwatchLogGroupConfig {
    const required: Partial<CloudwatchLogGroupConfig> = {
      name: `/aws/lambda/${this.functionName}`,
    };

    return Object.assign(
      {},
      Lambda.logGroupDefaults,
      config.logGroup,
      required
    );
  }

  removeResources(): void {
    this._role.removeResources();

    this.node.tryRemoveChild(Lambda.fnId);
    this.node.tryRemoveChild(Lambda.logId);
    this.node.tryRemoveChild(Lambda.alarmId);
    this.node.tryRemoveChild(Lambda.logDocId);
    this.node.tryRemoveChild(Lambda.vpcId);
    this.node.tryRemoveChild(Lambda.sgId);
    this.node.tryRemoveChild(Lambda.subnetId);
    this.node.tryRemoveChild(Lambda.regionId);
    this.node.tryRemoveChild(Lambda.policyId);
  }
}
