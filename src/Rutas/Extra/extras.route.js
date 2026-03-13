const Extras = require('../../models/extras.schema');
const createCrudRouter = require('../../utils/createCrudRouter');

module.exports = createCrudRouter(Extras, {
  createPayload: req => {
    const { name, price, year, priceperson, notes } = req.body;
    return { name, price, year, priceperson, notes };
  },
});
