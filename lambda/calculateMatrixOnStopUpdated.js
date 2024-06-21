const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const axios = require('axios');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

const listObjects = async () => {
  const params = {
    Bucket: process.env.BUCKET_NAME, // Use environment variable for the bucket name
    Prefix: 'stops/',
  };

  const command = new ListObjectsV2Command(params);
  const response = await s3Client.send(command);

  if (response.Contents && response.Contents.length > 0) {
    const objects = response.Contents.map(object => object.Key);
    return objects;
  } else {
    return [];
  }
};

const fetchStop = async (key) => {
  try {
    const command = new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    const body = await streamToString(response.Body);
    const stop = JSON.parse(body);
    stop.key = key; // Add the key to the stop object
    return stop;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return null;
    } else {
      throw error;
    }
  }
};

const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });

exports.handler = async (event) => {
  try {
    const availableStops = await listObjects();
    const stopContents = await Promise.all(availableStops.map(fetchStop));
    const stops = stopContents.filter(stop => stop !== null);

    if (stops.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Not enough stops to calculate the time matrix' }),
      };
    }

    const coordinates = stops.map(stop => `${stop.location.lng},${stop.location.lat}`).join(';');

    const profile = 'car';
    const url = `https://router.project-osrm.org/table/v1/${profile}/${coordinates}`;

    const osrmResponse = await axios.get(url);
    const { durations } = osrmResponse.data;

    const result = stops.map((stop, index) => ({
      id: stop.id,
      name: stop.name,
      location: stop.location,
      key: stop.key, // Include the key in the result
      durations: durations[index]
    }));

    const putParams = {
      Bucket: process.env.BUCKET_NAME, // Use environment variable for the bucket name
      Key: 'time-matrix.json',
      Body: JSON.stringify(result),
      ContentType: 'application/json'
    };

    const putCommand = new PutObjectCommand(putParams);
    await s3Client.send(putCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully fetched stop data, calculated time matrix, and saved the data to S3' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
