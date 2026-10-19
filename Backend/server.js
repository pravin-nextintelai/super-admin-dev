// Entry shim — keeps `node server.js`, nodemon and the Dockerfile CMD working.
// The application lives in src/ (see src/server.js and src/app.js).
require('./src/server');
