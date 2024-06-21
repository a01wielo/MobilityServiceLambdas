// lib/s3-lambda-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class S3LambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, 'MyBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT for production use
      autoDeleteObjects: true,
    });

    // Create Lambda function for addStop
    const addStopLambda = new NodejsFunction(this, 'AddStopFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/addStop.js'),
      handler: 'handler',
      bundling: {
        externalModules: ['aws-sdk'], // Use AWS SDK provided by Lambda runtime
      },
      environment: {
        BUCKET_NAME: bucket.bucketName
      },
    });

    // Create Lambda function for deleteStop
    const deleteStopLambda = new NodejsFunction(this, 'DeleteStopFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/deleteStop.js'),
      handler: 'handler',
      bundling: {
        externalModules: ['aws-sdk'],
      },
      environment: {
        BUCKET_NAME: bucket.bucketName
      },
    });

    // Create Lambda function for calculateMatrixOnStopUpdated
    const calculateMatrixLambda = new NodejsFunction(this, 'CalculateMatrixFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/calculateMatrixOnStopUpdated.js'),
      handler: 'handler',
      bundling: {
        externalModules: ['aws-sdk'],
      },
      environment: {
        BUCKET_NAME: bucket.bucketName
      },
    });

    // Grant the Lambda function read/write permissions to the S3 bucket
    bucket.grantReadWrite(addStopLambda);
    bucket.grantReadWrite(deleteStopLambda);
    bucket.grantReadWrite(calculateMatrixLambda);

    // Set up S3 event notifications to trigger calculateMatrixOnStopUpdated
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(calculateMatrixLambda),
      { prefix: 'stops/' }
    );

    bucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED_DELETE,
      new s3n.LambdaDestination(calculateMatrixLambda),
      { prefix: 'stops/' }
    );

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'MyApi', {
      restApiName: 'Stop Service',
    });

    // Create /add-stop resource
    const addStopIntegration = new apigateway.LambdaIntegration(addStopLambda);
    const addStopResource = api.root.addResource('add-stop');
    addStopResource.addMethod('POST', addStopIntegration);

    // Create /delete-stop resource
    const deleteStopIntegration = new apigateway.LambdaIntegration(deleteStopLambda);
    const deleteStopResource = api.root.addResource('delete-stop');
    deleteStopResource.addMethod('DELETE', deleteStopIntegration);
  }
}
