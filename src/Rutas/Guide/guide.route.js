const Guide = require('../../../src/models/guides.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Guide);
