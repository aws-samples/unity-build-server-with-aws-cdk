import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface UnityTestClientProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly bucket: s3.IBucket;
}

export class UnityTestClientStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: UnityTestClientProps) {
    super(scope, id, props);

    const { vpc, bucket } = props;

    const instance = new ec2.Instance(this, 'TestClient', {
      vpc,
      instanceType: new ec2.InstanceType('t3.small'),
      instanceName: 'TestClientInstance',
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(100, { encrypted: true }),
        },
      ],
    });

    instance.userData.addCommands(
      'yum -y update',
      // Add repository of Unity Hub: https://docs.unity3d.com/hub/manual/InstallHub.html?_ga=2.21717052.688751151.1670381691-131502634.1670381691#install-hub-linux
      'sh -c \'echo -e "[unityhub]\nname=Unity Hub\nbaseurl=https://hub.unity3d.com/linux/repos/rpm/stable\nenabled=1\ngpgcheck=1\ngpgkey=https://hub.unity3d.com/linux/repos/rpm/stable/repodata/repomd.xml.key\nrepo_gpgcheck=1" > /etc/yum.repos.d/unityhub.repo\'',
      'yum check-update',
      'yum -y install unityhub',
      'mkdir /usr/share/unity3d/config',
      'aws s3 cp ' + bucket.s3UrlForObject('services-config.json') + ' /usr/share/unity3d/config/',
    );

    instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    // Necessary to download server-config.json
    bucket.grantRead(instance.role);

    new cdk.CfnOutput(this, 'TestClientUrl', {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/ec2/home#InstanceDetails:instanceId=${instance.instanceId}`
    })
  }
}
