import { Construct } from "constructs";
import { ITerraformDependable, TerraformMetaArguments } from "cdktf";
import {
  LambdaFunction,
  LambdaFunctionConfig,
} from "@cdktf/provider-aws/lib/lambda-function";
import {
  CloudwatchLogGroup,
  CloudwatchLogGroupConfig,
} from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import {
  CloudwatchMetricAlarm,
  CloudwatchMetricAlarmConfig,
} from "@cdktf/provider-aws/lib/cloudwatch-metric-alarm";
import { IamRolePolicy } from "@cdktf/provider-aws/lib/iam-role-policy";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { DataAwsIamRole } from "@cdktf/provider-aws/lib/data-aws-iam-role";
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { DataAwsRegion } from "@cdktf/provider-aws/lib/data-aws-region";
import * as iam from "iam-floyd";
// import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";
// import { DataAwsPartition } from "@cdktf/provider-aws/lib/data-aws-partition";

export interface LambdaConfig extends Partial<LambdaFunctionConfig> {
  logGroup?: Partial<CloudwatchLogGroupConfig>;
  alarm?: Partial<CloudwatchMetricAlarmConfig>;

  roleName?: string;
  statement?: iam.PolicyStatement[];
}

export class Lambda extends Construct {
  public static functionDefaults: Partial<LambdaFunctionConfig> = {
    memorySize: 128,
    timeout: 300,
  };

  public static alarmDefaults: Partial<CloudwatchMetricAlarmConfig> = {
    alarmActions: [],
    period: 60,
    statistic: "SUM",
    datapointsToAlarm: 1,
    threshold: 0,
    comparisonOperator: "GreaterThanThreshold",
    treatMissingData: "notBreaching",
  };

  public static logGroupDefaults: Partial<CloudwatchLogGroupConfig> = {
    retentionInDays: 14,
  };

  constructor(scope: Construct, id: string, config: LambdaConfig) {
    super(scope, id);
    // const caller = new DataAwsCallerIdentity(scope, name);
    // const partition = new DataAwsPartition(scope, name);

    this.functionName = id;
    this.meta = config;
    this.region = new DataAwsRegion(scope, `${id}-region`);

    this.role = this.buildRole(config);

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
  public role: DataAwsIamRole | IamRole;

  public set logGroup(group: CloudwatchLogGroup) {
    const logging = new DataAwsIamPolicyDocument(
      this,
      `${this.functionName}-log-permissions`,
      {
        statement: [
          {
            effect: "Allow",
            actions: ["logs:*"],
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

  private functionName: string;
  private meta: TerraformMetaArguments;
  private region: DataAwsRegion;
  private _logGroup!: CloudwatchLogGroup;

  private withMeta<TerraformResourceConfig>(
    config: TerraformResourceConfig
  ): TerraformResourceConfig {
    return Object.assign({}, this.meta, config);
  }

  private buildRole(config: LambdaConfig): DataAwsIamRole | IamRole {
    const name = config.roleName;

    let role: DataAwsIamRole | IamRole;
    if (name) {
      role = new DataAwsIamRole(
        this,
        `${this.functionName}-external-role`,
        this.withMeta({ name })
      );
    } else {
      const assume = new DataAwsIamPolicyDocument(
        this,
        `${this.functionName}-assume`,
        this.withMeta({
          statement: [
            {
              effect: "Allow",
              actions: ["sts:AssumeRole"],
              principals: [
                {
                  type: "Service",
                  identifiers: ["lambda.amazonaws.com"],
                },
              ],
            },
          ],
        })
      );

      role = new IamRole(
        this,
        `${this.functionName}-role`,
        this.withMeta({
          name: `lambda-role-${this.functionName}`,
          assumeRolePolicy: assume.json,
        })
      );
    }

    if (config.statement) {
      const policy = {
        Version: "2012-10-17",
        Statement: config.statement,
      };

      new IamRolePolicy(
        this,
        `${this.functionName}-user-policy`,
        this.withMeta({
          name: `user-permissions-${this.functionName}`,
          role: role.arn,
          policy: JSON.stringify(policy),
        })
      );
    }

    return role;
  }

  private lambdaCfg(config: LambdaConfig): LambdaFunctionConfig {
    let depends = [this.logGroup as ITerraformDependable];
    if (config.dependsOn) depends = depends.concat(config.dependsOn);

    const required: LambdaFunctionConfig = {
      dependsOn: depends,
      functionName: this.functionName,
      role: this.role.arn,
    };

    return this.withMeta(
      Object.assign({}, Lambda.functionDefaults, config, required)
    );
  }

  private alarmCfg(config: LambdaConfig): CloudwatchMetricAlarmConfig {
    const required: Partial<CloudwatchMetricAlarmConfig> = {
      alarmName: `lambda-errors-${this.functionName}-${this.region.name}`,
      alarmDescription: `Error alarm for the ${this.functionName} Lambda function`,
      namespace: "AWS/Lambda",
      dimensions: { FunctionName: this.lambda.functionName },
      metricName: "Errors",
    };

    const intermediate = Object.assign({}, Lambda.alarmDefaults, config.alarm, required);

    const evaluationPeriods =
      this.lambdaCfg(config).timeout! / intermediate.period!;

    return this.withMeta(
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

    return this.withMeta(
      Object.assign({}, Lambda.logGroupDefaults, config.logGroup, required)
    );
  }
}
