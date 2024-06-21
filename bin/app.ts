// bin/app.ts
import * as cdk from 'aws-cdk-lib';
import { S3LambdaStack } from '../lib/s3-lambda-stack';

const app = new cdk.App();
new S3LambdaStack(app, 'S3LambdaStack');
