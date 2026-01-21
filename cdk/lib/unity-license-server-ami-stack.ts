import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';

interface LicenseServerAmiProps extends cdk.StackProps {
  readonly eni: ec2.CfnNetworkInterface;
  readonly bucket: s3.IBucket;
}

export class UnityLicenseServerAmiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LicenseServerAmiProps) {
    super(scope, id, props);

    const { eni, bucket } = props;

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    let script = readFileSync('./lib/resources/license-server-init-config.yaml', 'utf8');
    const userData = ec2.UserData.custom(script);

    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      instanceType: new ec2.InstanceType('t3.small'),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
      }),
      role,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(100, { encrypted: true }),
        },
      ],
      userData,
    });

    // Tokens are not properly resolved in cross stack
    // See also: https://github.com/aws/aws-cdk/issues/18882
    new ssm.StringParameter(this, 'Ref', {
      stringValue: eni.ref,
    });

    const cfnLaunchTemplate = launchTemplate.node.findChild('Resource') as ec2.CfnLaunchTemplate;
    cfnLaunchTemplate.addPropertyOverride('LaunchTemplateData.NetworkInterfaces', [
      {
        DeviceIndex: 0,
        DeleteOnTermination: false,
        NetworkInterfaceId: eni.ref,
      },
    ]);

    const instance = new ec2.CfnInstance(this, 'Instance', {
      launchTemplate: {
        version: launchTemplate.versionNumber,
        launchTemplateId: launchTemplate.launchTemplateId,
      },
      tags: [
        {
          key: 'Name',
          value: `${cdk.Stack.of(this).stackName}/Instance`,
        },
      ],
    });

    // Necessary to download license server zip files and upload server-registration-request.xml
    bucket.grantReadWrite(role);

    new cdk.CfnOutput(this, 'AmiInstanceURL', {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/ec2/home#InstanceDetails:instanceId=${instance.ref}`
    });
  }
}
