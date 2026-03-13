const Train = require('../../../src/models/train.schema');
const attachNestedArrayCrudRoutes = require('../../utils/attachNestedArrayCrudRoutes');
const createCrudRouter = require('../../utils/createCrudRouter');

const router = createCrudRouter(Train);

attachNestedArrayCrudRoutes(router, Train, {
  parentParam: 'trainId',
  arrayField: 'services',
  notFoundMessage: 'train not found',
  deleteNotFoundMessage: 'Train or Service not found',
});

module.exports = router;
