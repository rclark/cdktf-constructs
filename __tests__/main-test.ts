// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import "cdktf/lib/testing/adapters/jest"; // Load types for expect matchers
import { Testing } from "cdktf";
import { Lambda } from "../lib/lambda"
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";

describe("My CDKTF Application", () => {
  // The tests below are example tests, you can find more information at
  // https://cdk.tf/testing
  it.todo("should be tested");

  // // All Unit tests test the synthesised terraform code, it does not create real-world resources
  describe("Unit testing using assertions", () => {
    it("should contain a resource", async () => {
      // let lambda: Lambda;

      const synth = Testing.synthScope((scope) => {
        new Lambda(scope, "my-function", {});
      });

      expect(synth).toHaveResourceWithProperties(LambdaFunction, {
        function_name: "my-function",
        memory_size: 128,
        // role: lambda.role.arn,
        role: "${aws_iam_role.my-function_my-function-role_CF920605.arn}",
        timeout: 300,
      });
    });
  });

  describe("Unit testing using snapshots", () => {
    it("Tests the snapshot", () => {
      expect(Testing.synthScope((scope) => {
        new Lambda(scope, "my-function", {});
      })).toMatchSnapshot();
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
