import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { UnityTestClientStack } from '../lib/unity-test-client-stack';
import { UnityLicenseServerStack } from '../lib/unity-license-server-stack';
import { UnityLicenseServerAmiStack } from '../lib/unity-license-server-ami-stack';

test('UnityLicenseServerStack test', () => {
    const app = new cdk.App();

    const stack = new UnityLicenseServerStack(app, 'UnityLicenseServerStack', {})
    const template = Template.fromStack(stack);
    expect(template).toMatchSnapshot();
});

// Cross-stack snapshot is unavailable: https://github.com/aws/aws-cdk/issues/18847
// test('UnityLicenseServerAmiStack test', () => {
//     const app = new cdk.App();

//     const mockStack = new cdk.Stack(app);

//     const vpc = new ec2.Vpc(mockStack, 'Vpc');
//     const bucket = new s3.Bucket(mockStack, 'Bucket');

//     const eniSecurityGroup = new ec2.SecurityGroup(mockStack, 'EniSecurityGroup', { vpc });
//     eniSecurityGroup.connections.allowFrom(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(8080));
//     const eni = new ec2.CfnNetworkInterface(mockStack, 'LicenseServerEni', { subnetId: vpc.privateSubnets[0].subnetId });

//     const stack = new UnityLicenseServerAmiStack(app, 'UnityLicenseServerAmiStack', { eni, bucket });
//     const template = Template.fromStack(stack);
//     expect(template).toMatchSnapshot();
// });

// 
// test('UnityTestClientStack test', () => {
//     const app = new cdk.App();

//     const mockStack = new cdk.Stack(app);

//     const vpc = new ec2.Vpc(mockStack, 'Vpc');
//     const bucket = new s3.Bucket(mockStack, 'Bucket');

//     const stack = new UnityTestClientStack(app, 'UnityTestClientStack', { vpc, bucket });
//     const template = Template.fromStack(stack);
//     expect(template).toMatchSnapshot();
// });
