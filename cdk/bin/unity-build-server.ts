#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UnityLicenseServerStack } from '../lib/unity-license-server-stack';
import { UnityLicenseServerAmiStack } from '../lib/unity-license-server-ami-stack';
import { UnityTestClientStack } from '../lib/unity-test-client-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  region: 'us-east-1',
  // Set your AWS account ID when you import an existing VPC.
  // account: '123456789012'
};

const serverStack = new UnityLicenseServerStack(app, 'UnityLicenseServerStack', {
  env,
  // You can use an existing VPC by specifying vpcId.
  // vpcId: 'vpc-xxxxxxxx'

  // Input AMI ID created from EC2 instance in UnityLicenseServerAmiStack
  // licenseServerAmiId: 'ami-04bad4b6a2ebfcb5f',
});

new UnityLicenseServerAmiStack(app, 'UnityLicenseServerAmiStack', {
  env,
  eni: serverStack.eni,
  bucket: serverStack.bucket,
});

new UnityTestClientStack(app, 'UnityTestClientStack', {
  env,
  vpc: serverStack.vpc,
  bucket: serverStack.bucket,
});
