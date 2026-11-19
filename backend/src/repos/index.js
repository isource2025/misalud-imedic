const { config } = require('../config');
const { createMemoryRepos } = require('./memory');
const { createMssqlRepos } = require('./mssql');

let repos = null;

function getRepos() {
  if (!repos) repos = config.MOCK_MODE ? createMemoryRepos() : createMssqlRepos();
  return repos;
}

module.exports = { getRepos };
