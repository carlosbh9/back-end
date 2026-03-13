const Tariff = require('../models/tarifario.schema');

const SERVICE_TYPE_TO_DISCRIMINATOR = Object.freeze({
  entrance: 'Entrances',
  expeditions: 'Expeditions',
  experience: 'Experience',
  gourmet: 'LimaGourmet',
  guides: 'Guides',
  restaurant: 'Restaurant',
  transport: 'Transportation',
  operator: 'Operators',
  train: 'Train',
  hotel: 'Hotel',
  extra: 'extras',
});

function getDiscriminatorType(serviceType) {
  return SERVICE_TYPE_TO_DISCRIMINATOR[serviceType] || null;
}

async function findTariffByTypeAndId(serviceType, id, projection = null) {
  const discriminatorType = getDiscriminatorType(serviceType);
  if (!discriminatorType) {
    return null;
  }

  return Tariff.findOne({
    _id: id,
    type: discriminatorType,
  }, projection);
}

async function findNestedTariffService(serviceType, parentId, nestedId, arrayField) {
  const discriminatorType = getDiscriminatorType(serviceType);
  if (!discriminatorType) {
    return null;
  }

  const projection = {};
  projection[`${arrayField}.$`] = 1;

  const parentDoc = await Tariff.findOne({
    _id: parentId,
    type: discriminatorType,
    [`${arrayField}._id`]: nestedId,
  }, projection);

  if (!parentDoc) {
    return null;
  }

  return {
    parentDoc,
    nestedDoc: parentDoc[arrayField]?.[0] || null,
  };
}

module.exports = {
  findTariffByTypeAndId,
  findNestedTariffService,
  getDiscriminatorType,
};
