import * as cdk from '@aws-cdk/core';
import {RemovalPolicy} from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';

export class RepositoryStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'ecrImage', {
      repositoryName: 'data-product-admin',
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'repoUri', {
      value: this.repository.repositoryUri
    })
  }
}
