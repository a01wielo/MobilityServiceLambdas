// lambda/addStop.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// Initialize the S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });

function createHashKey(event) {
  return crypto.createHash('md5').update(event.id).digest('hex');
}

exports.handler = async (event) => {
  console.log(event['name']);

  // Validate the bus-stop object (optional)
  if (!event['id'] || !event['name'] || !event['location']) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'not enough information' }),
    };
  }

  const params = {
    Bucket: process.env.BUCKET_NAME, // Use environment variable for the bucket name
    Key: 'stops/' + createHashKey(event),
    Body: JSON.stringify(event),
    ContentType: 'application/json',
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Bus-stop added successfully' }),
  };
};