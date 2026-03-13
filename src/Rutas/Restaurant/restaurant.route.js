const Restaurant = require('../../../src/models/Restaurant.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Restaurant, {
  listQueryBuilder: req => {
    const sortField = req.query.sort || 'name';
    const sortOrder = req.query.order === 'desc' ? -1 : 1;
    return Restaurant.find().sort({ [sortField]: sortOrder }).exec();
  },
});
