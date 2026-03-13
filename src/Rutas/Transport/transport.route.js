const Transport = require('../../../src/models/transport.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Transport);
