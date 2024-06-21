exports.handler = async (event) => {
    console.log('Delete Stop Event:', event);
    // Add your implementation here
    return {
      statusCode: 200,
      body: JSON.stringify('Stop deleted successfully!'),
    };
  };
  