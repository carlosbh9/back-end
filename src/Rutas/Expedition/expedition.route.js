const Expedition = require('../../../src/models/expeditions.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Expedition);
