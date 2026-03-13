const LimaGourmet = require('../../../src/models/gourmet.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(LimaGourmet);
