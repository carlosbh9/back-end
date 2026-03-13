const Experience = require('../../../src/models/experience.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Experience);
