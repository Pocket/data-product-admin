import * as cdk from '@aws-cdk/core';
import {RemovalPolicy} from '@aws-cdk/core';
// import {CfnOutput} from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3'
import {BlockPublicAccess} from '@aws-cdk/aws-s3'
// import * as cloudfront from '@aws-cdk/aws-cloudfront'
// import {OriginProtocolPolicy} from '@aws-cdk/aws-cloudfront'
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';
import * as secrets_manager from '@aws-cdk/aws-secretsmanager';
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import {ApplicationLoadBalancedFargateService} from "@aws-cdk/aws-ecs-patterns/lib/fargate/application-load-balanced-fargate-service";
import {DeploymentCircuitBreaker} from "@aws-cdk/aws-ecs";

const dbUser = 'clusteradmin'
const dbName = 'strapi'

export class AdminStack extends cdk.Stack {
  public readonly service: ApplicationLoadBalancedFargateService

  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps & {repository: ecr.IRepository}) {
    super(scope, id, props)

    const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
      vpcId: 'vpc-012481e83ffa5e152',
    })

    const securityGroup = new ec2.SecurityGroup(this,'securityGroup', {
      vpc: vpc,
      allowAllOutbound: true,
    })

    // We are experiencing this bug: https://github.com/aws/aws-cdk/issues/10341
    const privateSubnetIds = ['subnet-07854aac95d07bb16', 'subnet-0eb99fe10e08d5d96', 'subnet-0a6c00fa564f97b10', 'subnet-04478ac1c55709b1f']
    const publicSubnetIds = ['subnet-0e72688834215913c', 'subnet-0eac4c4b2463a1653', 'subnet-081629325ceaecb2f', 'subnet-0113cd98b0579a9ce']
    // const subnets = vpc.selectSubnets({
    //   subnetFilters: [SubnetFilter.byIds(['subnet-07854aac95d07bb16', 'subnet-0eb99fe10e08d5d96', 'subnet-0a6c00fa564f97b10'])]
    // }).subnets
    const privateSubnets =  privateSubnetIds.map(id => ec2.Subnet.fromSubnetId(this, `subnet-${id}`, id))
    const publicSubnets =  publicSubnetIds.map(id => ec2.Subnet.fromSubnetId(this, `subnet-${id}`, id))

    const dbSecret = new secrets_manager.Secret(this, `dbSecret`, {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: dbUser,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const db = new rds.DatabaseCluster(this, 'database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_12_6 }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
        vpcSubnets: {
          subnets: privateSubnets,
        },
        vpc,
        securityGroups: [securityGroup],
        publiclyAccessible: false,
      },
      defaultDatabaseName: dbName,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const bucket = new s3.Bucket(this, 'bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: new BlockPublicAccess({
        blockPublicPolicy: true,
        restrictPublicBuckets: true,
      })
    // TODO: Permissions https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/deployment/hosting-guides/amazon-aws.html#_2-create-the-bucket
    })

    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc,
    })

    const alb = new elbv2.ApplicationLoadBalancer(this, 'alb', {
      vpc,
      internetFacing: true,
      vpcSubnets: {
        subnets: publicSubnets
      },
    })

    let dbCfg: {
      dbClusterIdentifier: string,
      password: string,
      dbname: string,
      engine: string,
      port: number,
      host: string,
      username: string,
    }

    this.service = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'ecsService', {
      cluster: cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(props.repository, 'latest'),
        containerPort: 1337,
        environment: {
          'STRAPI_LOG_LEVEL': 'debug',
          'DATABASE_CLIENT': 'postgres',
          'DATABASE_HOST': db.clusterEndpoint.hostname,
          'DATABASE_NAME': dbName,
          'DATABASE_USERNAME': dbUser,
          'BUCKET_NAME': bucket.bucketName,
        },
        secrets: {
          'DATABASE_PASSWORD': ecs.Secret.fromSecretsManager(dbSecret, 'password'),
          'DATABASE_PORT': ecs.Secret.fromSecretsManager(dbSecret, 'port'),
        }
      },
      taskSubnets: {
        subnets: privateSubnets,
      },
      loadBalancer: alb,
    });

    // const distribution = new cloudfront.CloudFrontWebDistribution(this, "distribution", {
    //   originConfigs: [
    //     {
    //       customOriginSource: {
    //         domainName: bucket.bucketWebsiteDomainName,
    //         originProtocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
    //       },
    //       behaviors : [ {
    //         pathPattern: '/_next/static/*',
    //         defaultTtl: cdk.Duration.days(30),
    //       },{
    //         isDefaultBehavior: true,
    //         defaultTtl: cdk.Duration.minutes(5),
    //       }]
    //     }
    //   ],
    // });

    new cdk.CfnOutput(this, 'dbSecretName', {
      value: db.secret?.secretName.valueOf() ?? 'unknown',
    });

    // new CfnOutput(this, 'cdnDomain', {
    //   value: distribution.distributionDomainName
    // });
  }
}
