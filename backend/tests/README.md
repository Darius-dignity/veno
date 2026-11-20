# Backend tests (Jest)

    npm install --save-dev jest

Add these scripts to package.json (the project uses ES modules, so Jest needs the flag):

    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:unit": "node --experimental-vm-modules node_modules/jest/bin/jest.js backend/tests/unit",
    "test:integration": "node --experimental-vm-modules node_modules/jest/bin/jest.js backend/tests/integration"

Run from the project root:

    npm test

The Jest configuration is in jest.config.js (project root).

## Layout
- `unit/`        one piece at a time, with fakes: validation, error handler, file safety, service rules, repository error mapping
- `integration/` the real app (routes, multer, validation, services, Mongoose models and hooks) on an in-memory database
- `helpers/`     `fake-db.js` (in-memory MongoDB behind the real models), `test-app.js` (starts the app), `files.js` (sample files)

The tests never connect to your real MongoDB.
Pictures saved by the upload tests are deleted when each test ends.
