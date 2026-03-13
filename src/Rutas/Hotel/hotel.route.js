const Hotel = require('../../../src/models/hotels.schema');
const attachNestedArrayCrudRoutes = require('../../utils/attachNestedArrayCrudRoutes');
const createCrudRouter = require('../../utils/createCrudRouter');

const router = createCrudRouter(Hotel);

attachNestedArrayCrudRoutes(router, Hotel, {
  parentParam: 'hotelId',
  arrayField: 'services',
  notFoundMessage: 'Hotel not found',
  deleteNotFoundMessage: 'Hotel or service not found',
});

module.exports = router;
