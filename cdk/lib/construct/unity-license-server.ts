import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { readFileSync } from 'fs';

export interface UnityLicenseServerProps {
  readonly eni: ec2.CfnNetworkInterface;
  readonly licenseServerAmiId: string;
}

export class UnityLicenseServer extends Construct {
  constructor(scope: Construct, id: string, props: UnityLicenseServerProps) {
    super(scope, id);

    const { eni, licenseServerAmiId } = props;

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    let script = readFileSync('./lib/resources/license-server-init-config.yaml', 'utf8');
    const userData = ec2.UserData.custom(script);

    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      instanceType: new ec2.InstanceType('t3.small'),
      machineImage: ec2.MachineImage.genericLinux({ [cdk.Stack.of(this).region]: licenseServerAmiId }),
      role: role,
      userData,
    });

    // Tokens are not properly resolved in cross stack
    // See also: https://github.com/aws/aws-cdk/issues/18882
    new StringParameter(this, 'Ref', {
      stringValue: eni.ref,
    });

    // Assign ENI and fix MAC address to validate Unity license server properly
    const cfnLaunchTemplate = launchTemplate.node.findChild('Resource') as ec2.CfnLaunchTemplate;
    cfnLaunchTemplate.addPropertyOverride('LaunchTemplateData.NetworkInterfaces', [
      {
        DeviceIndex: 0,
        DeleteOnTermination: false,
        NetworkInterfaceId: eni.ref,
      },
    ]);

    new ec2.CfnInstance(this, 'Instance', {
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
  }
}
