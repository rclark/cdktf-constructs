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

import { ShareableMeta } from '../shareable-meta';
import { Role, ServiceRole } from '../iam';
import { DataAwsSubnetIds } from '@cdktf/provider-aws/lib/data-aws-subnet-ids';
import { DataAwsSecurityGroups } from '@cdktf/provider-aws/lib/data-aws-security-groups';
import { DataAwsVpc } from '@cdktf/provider-aws/lib/data-aws-vpc';

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

export class Lambda extends ShareableMeta {
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

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id, config);

    this.id = id;
    this.functionName = config.functionName;
    this.region = new DataAwsRegion(scope, `${id}-region`);

    this.buildRole(config.role);

    this.logGroup = new CloudwatchLogGroup(
      this,
      `${id}-logs`,
      this.logCfg(config)
    );

    this.lambda = new LambdaFunction(this, id, this.lambdaCfg(config));

    this.alarm = new CloudwatchMetricAlarm(
      this,
      `${id}-alarm`,
      this.alarmCfg(config)
    );
  }

  public lambda: LambdaFunction;
  public alarm: CloudwatchMetricAlarm;

  private set logGroup(group: CloudwatchLogGroup) {
    const logging = new DataAwsIamPolicyDocument(
      this,
      `${this.functionName}-log-permissions`,
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

    new IamRolePolicy(this, `${this.functionName}-log-policy`, {
      name: `lambda-logging-${this.functionName}`,
      role: this.role.arn,
      policy: logging.json,
    });

    this._logGroup = group;
  }

  public get logGroup(): CloudwatchLogGroup {
    return this._logGroup;
  }

  private id: string;
  private functionName: string;
  private region: DataAwsRegion;
  private _logGroup!: CloudwatchLogGroup;
  private _role!: DataAwsIamRole | IamRole;

  public get role(): DataAwsIamRole | IamRole {
    return this._role;
  }

  public inVPC(config?: LambdaVpcConfig): Lambda {
    let { subnetIds, securityGroupIds, vpcId } = config || {};

    if (!config) {
      const defaultVpc = new DataAwsVpc(this, `${this.id}-vpc`, {});
      vpcId = defaultVpc.id;
    }

    if (vpcId) {
      const subnets = new DataAwsSubnetIds(this, `${this.id}-subnets`, {
        vpcId: vpcId,
      });
      subnetIds = subnetIds || subnets.ids;

      const security = new DataAwsSecurityGroups(this, `${this.id}-sg`, {
        filter: [{ name: 'vpc-id', values: [vpcId] }],
      });
      securityGroupIds = securityGroupIds || security.ids;
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
    const id = `${this.functionName}-role`;

    if (config && config.arn) {
      const existing = new Role(this, id, {
        arn: config.arn,
        policies: config.policies,
      });
      this._role = existing.role;
      return;
    }

    const newRole = new ServiceRole(this, id, {
      name: `lambda-role-${this.functionName}`,
      statement: config ? config.policies : [],
      services: ['lambda'],
    });
    this._role = newRole.role;
  }

  private lambdaCfg(config: LambdaConfig): LambdaFunctionConfig {
    let depends = [this.logGroup as ITerraformDependable];
    if (config.dependsOn) depends = depends.concat(config.dependsOn);

    const required: LambdaFunctionConfig = {
      dependsOn: depends,
      functionName: this.functionName,
      role: this.role.arn,
    };

    return this.sharedMeta(
      Object.assign({}, Lambda.functionDefaults, config, required)
    );
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

    return this.sharedMeta(
      Object.assign(
        { evaluationPeriods },
        intermediate
      ) as CloudwatchMetricAlarmConfig
    );
  }

  private logCfg(config: LambdaConfig): CloudwatchLogGroupConfig {
    const required: Partial<CloudwatchLogGroupConfig> = {
      name: `/aws/lambda/${this.functionName}`,
    };

    return this.sharedMeta(
      Object.assign({}, Lambda.logGroupDefaults, config.logGroup, required)
    );
  }
}
