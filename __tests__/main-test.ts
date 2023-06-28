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

describe('cdk-constructs', () => {
  describe('Lambda', () => {
    it('builds with minimal configuration', () => {
      const synth = Testing.synthScope((scope) => {
        new Lambda(scope, 'my-function', { functionName: 'my-function' });
      });
      expect(synth).toMatchSnapshot();
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
