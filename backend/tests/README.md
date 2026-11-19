# Backend tests

Built with Node's built-in test runner: nothing extra to install.

    npm test                 all tests
    npm run test:unit        unit tests only
    npm run test:integration integration tests only

Add these scripts to package.json:

    "test": "node --test \"backend/tests/**/*.test.js\"",
    "test:unit": "node --test \"backend/tests/unit/*.test.js\"",
    "test:integration": "node --test \"backend/tests/integration/*.test.js\""

Needs Node 22 or newer (older Node: use `node --test` without the pattern).

## Layout
- `unit/`        one piece at a time, with fakes: validation, error handler, file safety, service rules, repository error mapping
- `integration/` the real app (routes, multer, validation, services, Mongoose models and hooks) on an in-memory database
- `helpers/`     `fake-db.js` (in-memory MongoDB behind the real models), `test-app.js` (starts the app), `files.js` (sample files)

The tests never connect to your real MongoDB.
Pictures saved by the upload tests are deleted when each test ends.
