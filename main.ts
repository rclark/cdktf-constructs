import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";
import { Lambda } from "./lib/lambda";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import * as iam from "iam-floyd";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new S3Bucket(this, "bucket", {
      bucket: "my-bucket",
    });

    new AwsProvider(this, "aws", { region: "us-west-2" });
    new Lambda(this, "s3-bucket-controller", {
      dependsOn: [bucket],
      statement: [new iam.S3().allow().allActions().on(bucket.arn)],
    });
  }
}

const app = new App();
new MyStack(app, "cdktf-constructs");
app.synth();
