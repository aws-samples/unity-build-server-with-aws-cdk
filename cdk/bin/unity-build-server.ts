#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UnityLicenseServerStack } from '../lib/unity-license-server-stack';
import { UnityLicenseServerAmiStack } from '../lib/unity-license-server-ami-stack';
import { UnityTestClientStack } from '../lib/unity-test-client-stack';

const app = new cdk.App();

const env: cdk.Environment = { region: 'us-east-1' };

const serverStack = new UnityLicenseServerStack(app, 'UnityLicenseServerStack', {
  env,
  // Input AMI ID created from EC2 instance in UnityLicenseServerAmiStack
  // licenseServerAmiId: 'ami-04bad4b6a2ebfcb5f', // us-east-1
});

new UnityLicenseServerAmiStack(app, 'UnityLicenseServerAmiStack', {
  env,
  eni: serverStack.eni,
  bucket: serverStack.bucket,
});

new UnityTestClientStack(app, 'UnityTestClientStack', {
  env,
  vpc: serverStack.vpc,
  bucket: serverStack.bucket
})
