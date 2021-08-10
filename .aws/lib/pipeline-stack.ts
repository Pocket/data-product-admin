import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';
import {App, Stack} from '@aws-cdk/core';
import * as ecr from "@aws-cdk/aws-ecr";
import * as ecs from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import {Effect} from "@aws-cdk/aws-iam";
import {EcsDeployAction} from "@aws-cdk/aws-codepipeline-actions";

// const codestarConnectionArn = 'arn:aws:codestar-connections:us-east-1:996905175585:connection/5fa5aa2b-a2d2-43e3-ab5a-72ececfc1870'; // prod
const codestarConnectionArn = 'arn:aws:codestar-connections:us-east-1:410318598490:connection/7426c139-1aa0-49e2-aabc-5aef11092032'; //dev
// const nodeEnv = 'prod';
// const docsStackName = 'DataProductDocs';
// const runtimeVersions = {
//   nodejs: 14,
// };
// const environmentVariables = {
//   NODE_ENV: { value: nodeEnv }
// };
const buildImage = codebuild.LinuxBuildImage.STANDARD_5_0;

export class PipelineStack extends Stack {
  constructor(app: App, id: string, props: cdk.StackProps & {
    repository: ecr.IRepository,
    service: ecs.IBaseService,
  }) {
    super(app, id, props);

    const dockerBuild = new codebuild.PipelineProject(
      this,
      `${id}DockerBuild`,
      {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            pre_build: {
              commands: [
                'echo Logging in to Amazon ECR...',
                'aws --version',
                'echo $AWS_DEFAULT_REGION',
                'docker login -u AWS -p $(aws ecr get-login-password --region $AWS_DEFAULT_REGION) ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com',
                'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                'IMAGE_TAG=${COMMIT_HASH:=latest}',
              ],
            },
            build: {
              commands: [
                'echo Build started on `date`',
                'echo Building the Docker image...',
                'docker build -t $REPOSITORY_URI:latest .',
                'docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG',
              ],
            },
            post_build: {
              commands: [
                'echo Build completed on `date`',
                'echo Pushing the Docker images...',
                'docker push $REPOSITORY_URI:latest',
                'docker push $REPOSITORY_URI:$IMAGE_TAG',
                'printf "[{\\"name\\": \\"web\\", \\"imageUri\\": \\"${REPOSITORY_URI}:${IMAGE_TAG}\\"}]" > imagedefinitions.json'
              ],
            },
          },
          artifacts: {
            files: [`imagedefinitions.json`],
          },
        }),
        environment: {
          environmentVariables: {
            "REPOSITORY_URI": {
              value: props.repository.repositoryUri
            },
            "AWS_ACCOUNT_ID": {
              value: cdk.Aws.ACCOUNT_ID,
            },
          },
          privileged: true,
          buildImage
        },
      }
    )

    dockerBuild.addToRolePolicy(new iam.PolicyStatement({
      resources: [props.repository.repositoryArn],
      actions: [
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
      ],
    }))

    dockerBuild.addToRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: [
        "ecr:GetAuthorizationToken",
      ],
    }))

    const sourceOutput = new codepipeline.Artifact('Source');
    const buildArtifacts = new codepipeline.Artifact('CdkBuildOutput');

    const pipeline = new codepipeline.Pipeline(this, 'pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeStarConnectionsSourceAction({
              actionName: 'GithubSource',
              owner: 'Pocket',
              repo: 'data-product-admin',
              branch: 'main',
              output: sourceOutput,
              connectionArn: codestarConnectionArn,
            })
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'DockerBuild',
              project: dockerBuild,
              input: sourceOutput,
              outputs: [buildArtifacts],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new EcsDeployAction({
              actionName: 'Deploy',
              service: props.service,
              input: buildArtifacts,
            }),
          ],
        },
      ],
    });
  }
}
