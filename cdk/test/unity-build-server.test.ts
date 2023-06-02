import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { UnityTestClientStack } from '../lib/unity-test-client-stack';
import { UnityLicenseServerStack } from '../lib/unity-license-server-stack';
import { UnityLicenseServerAmiStack } from '../lib/unity-license-server-ami-stack';

test('UnityLicenseServerStack test', () => {
  const app = new cdk.App();

  const license = new UnityLicenseServerStack(app, 'UnityLicenseServerStack', {});
  const ami = new UnityLicenseServerAmiStack(app, 'UnityLicenseServerAmiStack', {
    eni: license.eni,
    bucket: license.bucket,
  });
  const client = new UnityTestClientStack(app, 'UnityTestClientStack', { vpc: license.vpc, bucket: license.bucket });

  expect(Template.fromStack(license)).toMatchSnapshot();
  expect(Template.fromStack(ami)).toMatchSnapshot();
  expect(Template.fromStack(client)).toMatchSnapshot();
});
