import { Construct } from 'constructs';
import { TerraformMetaArguments } from 'cdktf';

export class ShareableMeta extends Construct {
  private meta: TerraformMetaArguments;

  constructor(scope: Construct, id: string, config: TerraformMetaArguments) {
    super(scope, id);
    this.meta = config;
  }

  public sharedMeta<TerraformResourceConfig>(
    config: TerraformResourceConfig
  ): TerraformResourceConfig {
    return Object.assign({}, this.meta, config);
  }
}
