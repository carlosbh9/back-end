const Operator = require('../../../src/models/operators.schema');
const attachNestedArrayCrudRoutes = require('../../utils/attachNestedArrayCrudRoutes');
const createCrudRouter = require('../../utils/createCrudRouter');

const router = createCrudRouter(Operator);

attachNestedArrayCrudRoutes(router, Operator, {
  parentParam: 'operatorId',
  arrayField: 'servicios',
  routeSegment: 'services',
  notFoundMessage: 'Operator not found',
  deleteNotFoundMessage: 'Operator or Service not found',
});

module.exports = router;
