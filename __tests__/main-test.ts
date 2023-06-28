// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import 'cdktf/lib/testing/adapters/jest'; // Load types for expect matchers
import { TerraformStack, Testing } from 'cdktf';
import { Lambda } from '../lib/lambda';
import {
  ExistingRoleConfig,
  NewRoleConfig,
  PrincipalType,
  Role,
} from '../lib/iam';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DockerLambda, DockerLambdaConfig } from '../lib/lambda/docker-lambda';
import { MetricStatistic } from '../lib/lambda/lambda';

const fakeArn = 'arn:aws:service:us-west-2:123456789012:entity';
const fakeSecurityGroup = 'sg-7ca1556d';
const fakeSubnet = 'subnet-362d0717';

describe('cdk-constructs', () => {
  describe('Lambda', () => {
    it('builds with minimal configuration', () => {
      const synth = Testing.synthScope((scope) => {
        new Lambda(scope, 'my-function', { functionName: 'my-function' });
      });
      expect(synth).toMatchSnapshot();
    });
  });

  describe('DockerLambda', () => {
    describe('with minimal configuration', () => {
      const cfg: DockerLambdaConfig = {
        functionName: 'my-function',
        imageUri: 'public.ecr.aws/lambda/provided:al2',
      };

      it('builds', () => {
        const synth = Testing.synthScope((scope) => {
          new DockerLambda(scope, 'id', cfg);
        });
        expect(synth).toMatchSnapshot();
      });

      it('makes valid terraform', () => {
        const app = Testing.app();
        const stack = new TerraformStack(app, 'test');
        new AwsProvider(stack, 'aws', { region: 'us-west-2' });
        new DockerLambda(stack, 'id', cfg);

        expect(Testing.fullSynth(stack)).toBeValidTerraform();
      });
    });

    describe('with maximal configuration', () => {
      const cfg: DockerLambdaConfig = {
        functionName: 'my-function',
        imageUri: 'public.ecr.aws/lambda/provided:al2',
        architectures: ['x86_64'],
        codeSigningConfigArn: fakeArn,
        deadLetterConfig: {
          targetArn: fakeArn,
        },
        description: 'described',
        environment: { variables: { KEY: 'value' } },
        ephemeralStorage: { size: 512 },
        fileSystemConfig: { arn: fakeArn, localMountPath: '/mnt/something' },
        imageConfig: {
          command: ['foo'],
          entryPoint: ['bar'],
          workingDirectory: 'baz',
        },
        kmsKeyArn: fakeArn,
        layers: [fakeArn],
        memorySize: 512,
        publish: false,
        reservedConcurrentExecutions: -1,
        replaceSecurityGroupsOnDestroy: false,
        replacementSecurityGroupIds: [fakeSecurityGroup],
        skipDestroy: false,
        tags: { tag: 'value' },
        timeout: 3,
        tracingConfig: { mode: 'Active' },
        vpcConfig: {
          securityGroupIds: [fakeSecurityGroup],
          subnetIds: [fakeSubnet],
        },
        logGroup: {
          skipDestroy: false,
          retentionInDays: 7,
          kmsKeyId: fakeArn,
          tags: { tag: 'value' },
        },
        alarm: {
          comparisonOperator: 'GreaterThanOrEqualToThreshold',
          evaluationPeriods: 2,
          period: 120,
          statistic: MetricStatistic.AVG,
          threshold: 10,
          actionsEnabled: true,
          alarmActions: [fakeArn],
          datapointsToAlarm: 1,
          insufficientDataActions: [fakeArn],
          okActions: [fakeArn],
          treatMissingData: 'missing',
          tags: { tag: 'value' },
        },
      };

      it('builds', () => {
        const synth = Testing.synthScope((scope) => {
          new DockerLambda(scope, 'id', cfg);
        });
        expect(synth).toMatchSnapshot();
      });

      it('makes valid terraform', () => {
        const app = Testing.app();
        const stack = new TerraformStack(app, 'test');
        new AwsProvider(stack, 'aws', { region: 'us-west-2' });
        new DockerLambda(stack, 'id', cfg);

        expect(Testing.fullSynth(stack)).toBeValidTerraform();
      });
    });
  });

  describe('Role', () => {
    describe('with minimal configuration', () => {
      describe('a new role', () => {
        const cfg: NewRoleConfig = {
          name: 'new-role',
          principals: [
            {
              type: PrincipalType.AWS,
              identifiers: ['arn:aws:iam::1234567890:user/chuck'],
            },
          ],
        };

        it('builds', () => {
          const synth = Testing.synthScope((scope) => {
            new Role(scope, 'my-role', cfg);
          });
          expect(synth).toMatchSnapshot();
        });

        it('makes valid terraform', () => {
          const app = Testing.app();
          const stack = new TerraformStack(app, 'test');
          new AwsProvider(stack, 'aws', { region: 'us-west-2' });
          new Role(stack, 'my-role', cfg);

          expect(Testing.fullSynth(stack)).toBeValidTerraform();
        });
      });

      describe('an existing role', () => {
        const cfg: ExistingRoleConfig = {
          arn: 'arn:aws:iam::1234567890:role/developer',
        };

        it('builds', () => {
          const synth = Testing.synthScope((scope) => {
            new Role(scope, 'my-role', cfg);
          });
          expect(synth).toMatchSnapshot();
        });

        it('makes valid terraform', () => {
          const app = Testing.app();
          const stack = new TerraformStack(app, 'test');
          new AwsProvider(stack, 'aws', { region: 'us-west-2' });
          new Role(stack, 'my-role', cfg);

          expect(Testing.fullSynth(stack)).toBeValidTerraform();
        });
      });
    });
  });

  //   it("Tests a combination of resources", () => {
  //     expect(
  //       Testing.synthScope((stack) => {
  //         new TestDataSource(stack, "test-data-source", {
  //           name: "foo",
  //         });

  //         new TestResource(stack, "test-resource", {
  //           name: "bar",
  //         });
  //       })
  //     ).toMatchInlineSnapshot();
  //   });
  // });

  // describe("Checking validity", () => {
  //   it("check if the produced terraform configuration is valid", () => {
  //     const app = Testing.app();
  //     const stack = new TerraformStack(app, "test");

  //     new TestDataSource(stack, "test-data-source", {
  //       name: "foo",
  //     });

  //     new TestResource(stack, "test-resource", {
  //       name: "bar",
  //     });
  //     expect(Testing.fullSynth(app)).toBeValidTerraform();
  //   });

  //   it("check if this can be planned", () => {
  //     const app = Testing.app();
  //     const stack = new TerraformStack(app, "test");

  //     new TestDataSource(stack, "test-data-source", {
  //       name: "foo",
  //     });

  //     new TestResource(stack, "test-resource", {
  //       name: "bar",
  //     });
  //     expect(Testing.fullSynth(app)).toPlanSuccessfully();
  //   });
  // });
});
