const Entrance = require('../../../src/models/entrances.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Entrance);
