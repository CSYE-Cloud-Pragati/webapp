const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Run fileRoutes first, healthCheck last (healthCheck closes the DB connection)
    return tests.sort((a, b) => {
      if (a.path.includes('fileRoutes')) return -1;
      if (b.path.includes('fileRoutes')) return 1;
      return 0;
    });
  }
}

module.exports = CustomSequencer;
