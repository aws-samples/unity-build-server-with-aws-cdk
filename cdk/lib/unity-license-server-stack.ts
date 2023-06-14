import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { UnityLicenseServer } from './construct/unity-license-server';

interface UnityLicenseServerStackProps extends cdk.StackProps {
  /**
   * The id for the AMI of your Unity license server.
   * Set this after you created an AMI with unity-license-server-ami-stack.
   * @default no license server is deployed
   */
  readonly licenseServerAmiId?: string;

  /**
   * The VPC id you want to deploy the license server.
   * @default A new VPC is created
   */
  readonly vpcId?: string;

  /**
   * Set this false to allow CloudFormation to delete or replace the ENI.
   * @default your ENI will not be replaced or removed on deployment to prevent accidental removal of the ENI assigned to your license.
   */
  readonly retainEni?: boolean;
}

export class UnityLicenseServerStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly eni: ec2.CfnNetworkInterface;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: UnityLicenseServerStackProps) {
    super(scope, id, props);

    const logBucket = new s3.Bucket(this, 'LogBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    let vpc: ec2.IVpc;
    if (props.vpcId == null) {
      vpc = new ec2.Vpc(this, 'Vpc', {
        gatewayEndpoints: {
          S3: {
            service: ec2.GatewayVpcEndpointAwsService.S3,
          },
        },
      });
      vpc.addFlowLog('FlowLogs', { destination: ec2.FlowLogDestination.toS3(logBucket, 'vpc-flow-logs') });
    } else {
      vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId });
    }

    const eniSecurityGroup = new ec2.SecurityGroup(this, 'EniSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    eniSecurityGroup.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(8080), 'Allow TCP 8080');

    const eni = new ec2.CfnNetworkInterface(this, 'LicenseServerEni', {
      subnetId: vpc.privateSubnets[0].subnetId,
      groupSet: [eniSecurityGroup.securityGroupId],
      tags: [
        {
          key: 'Name',
          value: 'UnityLicenseServerEni',
        },
      ],
    });
    if (props.retainEni ?? true) {
      eni.applyRemovalPolicy(RemovalPolicy.RETAIN);
    } else {
      eni.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }

    const bucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 'license-server-bucket-access-logs/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    if (props.licenseServerAmiId != null) {
      new UnityLicenseServer(this, 'LicenseServer', {
        eni,
        licenseServerAmiId: props.licenseServerAmiId,
      });
    }

    // URL for the S3 Bucket
    new cdk.CfnOutput(this, 'S3BucketUrl', {
      value: `https://s3.console.aws.amazon.com/s3/buckets/${bucket.bucketName}`,
    });

    this.vpc = vpc;
    this.eni = eni;
    this.bucket = bucket;
  }
}
