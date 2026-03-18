const serverless = require('serverless-http');
const app = require('../../backend/server');

// Wrap with serverless-http, telling it to prefix /api back onto every request
// because netlify.toml redirects /api/* → /.netlify/functions/api/:splat
// which strips the /api prefix before the function receives the request.
const handler = serverless(app, {
  request(req) {
    // Restore the /api prefix so Express routes like app.use('/api/auth') work correctly
    if (!req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
});

module.exports = { handler };
