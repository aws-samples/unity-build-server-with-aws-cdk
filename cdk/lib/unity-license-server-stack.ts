import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { UnityLicenseServer } from './construct/unity-license-server';

interface UnityLicenseServerStackProps extends cdk.StackProps {
  readonly licenseServerAmiId?: string;
}

export class UnityLicenseServerStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
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

    const vpc = new ec2.Vpc(this, 'Vpc', {
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });
    vpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(
        logBucket, 'vpc-flow-logs')
    });
    vpc.node.findChild("FlowLogs").node.findChild("FlowLog").node.addDependency(logBucket);

    const eniSecurityGroup = new ec2.SecurityGroup(this, 'EniSecurityGroup', {
      vpc,
      securityGroupName: 'LicenseServerEniSecurityGroup',
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

    const bucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 'license-server-bucket-access-logs',
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
    })

    this.vpc = vpc;
    this.eni = eni;
    this.bucket = bucket;
  }
}
