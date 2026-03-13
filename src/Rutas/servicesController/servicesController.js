const { RestrictionError } = require('../../utils/errors');
const {
  findTariffByTypeAndId,
  findNestedTariffService,
} = require('../../utils/tariffResolver');

exports.getServicePrices = async (req, res) => {
  try {
    const { services, children_ages, number_paxs, date } = req.body;
    const results = [];
    let globalAlerts = [];

    for (const service of services) {
      const { service_id, service_type, operator_service_id, train_service_id } = service;
      let serviceData;

      switch (service_type) {
        case 'entrance':
          serviceData = await findTariffByTypeAndId('entrance', service_id);
          if (serviceData) {
            const calculatedPrice = calculateEntrancePrice(serviceData, children_ages, number_paxs);
            const calculatePricebase = calculateEntrancePrice(serviceData, [], [1]);
            globalAlerts.push(...calculatedPrice.alerts);
            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.description,
              price_base: calculatePricebase.adultPrices[0],
              prices: calculatedPrice.adultPrices,
            });
            if (calculatedPrice.childPrices[0] > 0) {
              results.push({
                city: service.city,
                day: service.day,
                name_service: `${serviceData.description} KIDS`,
                price_base: 0,
                prices: calculatedPrice.childPrices,
              });
            }
          }
          break;

        case 'expeditions':
          serviceData = await findTariffByTypeAndId('expeditions', service_id);
          if (serviceData) {
            const calculatedPrice = calculateExpeditionPrice(serviceData, number_paxs);
            const calculatePricebase = calculateExpeditionPrice(serviceData, [1]);
            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.name,
              price_base: calculatePricebase[0],
              prices: calculatedPrice,
            });
          }
          break;

        case 'experience':
          serviceData = await findTariffByTypeAndId('experience', service_id);
          if (serviceData) {
            try {
              const calculatedPrice = calculateExperiencePrice(serviceData, number_paxs, children_ages);
              const calculatePricebase = calculateExperiencePrice(serviceData, [1]);
              results.push({
                city: service.city,
                day: service.day,
                name_service: serviceData.name,
                price_base: calculatePricebase[0],
                prices: calculatedPrice,
              });
            } catch (error) {
              if (error instanceof RestrictionError) {
                return res.status(400).json({
                  message: error.message,
                });
              }
              throw error;
            }
          }
          break;

        case 'gourmet':
          serviceData = await findTariffByTypeAndId('gourmet', service_id);
          if (serviceData) {
            const calculatedPrice = calculateGourmetPrice(serviceData, children_ages, number_paxs);
            const calculatePricebase = calculateGourmetPrice(serviceData, [], [1]);

            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.activitie,
              price_base: calculatePricebase.adultPrices[0],
              prices: calculatedPrice.adultPrices,
            });

            if (calculatedPrice.childPrices[0] > 0) {
              results.push({
                city: service.city,
                day: service.day,
                name_service: `${serviceData.activitie} KIDS`,
                price_base: 0,
                prices: calculatedPrice.childPrices,
              });
            }
          }
          break;

        case 'guides':
          serviceData = await findTariffByTypeAndId('guides', service_id);
          if (serviceData) {
            const calculatedPrice = calculateGuidePrice(serviceData, number_paxs, date);
            const calculatePricebase = calculateGuidePrice(serviceData, [1], date);
            globalAlerts = [...globalAlerts, ...calculatedPrice.alerts];
            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.name_guide,
              price_base: calculatePricebase.totalPrice[0],
              prices: calculatedPrice.totalPrice,
            });
          }
          break;

        case 'restaurant':
          serviceData = await findTariffByTypeAndId('restaurant', service_id);
          if (serviceData) {
            const calculatedPrice = calculateRestaurantPrice(serviceData, children_ages, number_paxs, date);
            const calculatePricebase = calculateRestaurantPrice(serviceData, children_ages, [1], date);
            globalAlerts = [...globalAlerts, ...calculatedPrice.alerts];
            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.name,
              price_base: calculatePricebase.adultPrices[0],
              prices: calculatedPrice.adultPrices,
            });
            if (calculatedPrice.childPrices[0] > 0) {
              results.push({
                city: service.city,
                day: service.day,
                name_service: `${serviceData.name} KIDS`,
                price_base: 0,
                prices: calculatedPrice.childPrices,
              });
            }
          }
          break;

        case 'transport':
          serviceData = await findTariffByTypeAndId('transport', service_id);
          if (serviceData) {
            const calculatedPrice = calculateVehiclePrice(serviceData, number_paxs);
            const calculatePricebase = calculateVehiclePrice(serviceData, [1]);

            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.nombre,
              price_base: calculatePricebase[0],
              prices: calculatedPrice,
            });
          }
          break;

        case 'operator':
          serviceData = (
            await findNestedTariffService('operator', service_id, operator_service_id, 'servicios')
          )?.nestedDoc;

          if (serviceData) {
            const calculatedPrice = calculateOperatorsPrice(serviceData, number_paxs);
            const calculatePricebase = calculateOperatorsPrice(serviceData, [1]);

            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.descripcion,
              price_base: calculatePricebase[0],
              prices: calculatedPrice,
            });
          }
          break;

        case 'train':
          serviceData = (
            await findNestedTariffService('train', service_id, train_service_id, 'services')
          )?.nestedDoc;

          if (serviceData) {
            const calculatedPrice = calculateTrainsPrices(serviceData, number_paxs, children_ages);
            const calculatePricebase = calculateTrainsPrices(serviceData, [1], children_ages);

            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.serviceName,
              price_base: calculatePricebase[0],
              prices: calculatedPrice,
            });
          }
          break;

        case 'extra':
          serviceData = await findTariffByTypeAndId('extra', service_id);
          if (serviceData) {
            const calculatedPrice = calculateExtraPrice(serviceData, number_paxs);
            const calculatePricebase = calculateExtraPrice(serviceData, [1]);
            results.push({
              city: service.city,
              day: service.day,
              name_service: serviceData.name,
              price_base: calculatePricebase[0],
              prices: calculatedPrice,
            });
          }
          break;

        default:
          console.log(`Tipo de servicio desconocido: ${service_type}`);
      }
    }

    res.status(200).json({ services: results, date, alerts: globalAlerts });
  } catch (error) {
    console.error('Error obteniendo precios de servicios:', error);
    res.status(500).json({ message: 'Error al obtener precios de servicios' + error });
  }
};

function calculateEntrancePrice(serviceData, children_ages, number_paxs) {
  const childPrice = serviceData.childRate ? serviceData.childRate.pp : 0;
  const adultPrice = serviceData.price_pp;
  const maxChildAge = serviceData.childRate ? serviceData.childRate.upTo : 0;

  const childPrices = [];
  const adultPrices = [];
  const alerts = [];

  number_paxs.forEach(numPax => {
    let totalChildPrice = 0;
    let totalAdultPrice = 0;
    let numChildren = 0;

    children_ages.forEach(age => {
      if (age <= maxChildAge && numChildren < numPax) {
        totalChildPrice += childPrice;
        numChildren++;
        alerts.push(`NiÃ±o con edad ${age} tomÃ³ precio de niÃ±o $ ${childPrice}.00`);
      }
    });

    const numAdults = numPax - numChildren;
    totalAdultPrice += numAdults * adultPrice;

    childPrices.push(totalChildPrice);
    adultPrices.push(totalAdultPrice);
  });

  return { childPrices, adultPrices, alerts };
}

function calculateExpeditionPrice(serviceData, number_paxs) {
  const pricePerPerson = serviceData.price_pp;
  const isPricePerPerson = serviceData.priceperson;
  return number_paxs.map(numPax => {
    return isPricePerPerson ? pricePerPerson * numPax : pricePerPerson;
  });
}

function calculateExperiencePrice(serviceData, number_paxs, children_ages) {
  const isPricePerPerson = serviceData.priceperson;
  const childRate = serviceData.childRate;

  return number_paxs.map(numPax => {
    const priceInfo = serviceData.prices.find(price => price.groupSize === numPax);
    if (!priceInfo) return 0;

    if (!isPricePerPerson) {
      return priceInfo.pricePerPerson;
    }

    let totalPrice = 0;

    (children_ages || []).forEach(age => {
      if (age < childRate.minimumAge) {
        throw new RestrictionError(
          `La edad ${age} es menor a la edad mÃ­nima (${childRate.minimumAge}) para esta experiencia.`
        );
      } else if (age <= childRate.upTo) {
        totalPrice += childRate.pp || priceInfo.pricePerPerson;
      } else {
        totalPrice += priceInfo.pricePerPerson;
      }
    });

    const numAdults = numPax - (children_ages ? children_ages.length : 0);
    if (numAdults > 0) {
      totalPrice += numAdults * priceInfo.pricePerPerson;
    }

    return totalPrice;
  });
}

function calculateGourmetPrice(serviceData, children_ages, number_paxs) {
  const childPrices = [];
  const adultPrices = [];

  number_paxs.map(numPax => {
    let totalChildPrice = 0;
    let totalAdultPrice = 0;

    if (numPax === 1) {
      totalAdultPrice = serviceData.price_for_one_person;
    } else {
      children_ages.slice(0, numPax).forEach(age => {
        if (age >= serviceData.childRate.from && age <= serviceData.childRate.upTo) {
          totalChildPrice += serviceData.childRate.price;
        } else {
          totalChildPrice += serviceData.price_pp;
        }
      });

      const adultsCount = numPax - children_ages.length;
      if (adultsCount > 0) {
        totalAdultPrice += adultsCount * serviceData.price_pp;
      }
    }

    childPrices.push(totalChildPrice);
    adultPrices.push(totalAdultPrice);
  });

  return { childPrices, adultPrices };
}

function calculateGuidePrice(serviceData, number_paxs, date) {
  const totalPrice = [];
  let alerts = [];

  number_paxs.map(numPax => {
    let total = 0;

    let basePrice = 0;
    if (numPax === 1) {
      basePrice = serviceData.price_guide;
    } else if (numPax <= 9) {
      basePrice = serviceData.price_guide;
    } else {
      const additionalGuides = Math.ceil((numPax - 9) / 9);
      basePrice = serviceData.price_guide * (1 + additionalGuides);
    }

    total += basePrice;

    const surchargeDates = [
      '2025-05-01',
      '2025-07-28',
      '2025-07-29',
      '2025-12-25',
      '2025-01-01',
    ];

    if (surchargeDates.includes(date)) {
      total *= 1.5;
      alerts.push('Aplicar recargo del 50% por fechas especificas');
    }
    totalPrice.push(total);
  });

  return { totalPrice, alerts };
}

function calculateRestaurantPrice(serviceData, children_ages, number_paxs, date) {
  const adultPrices = [];
  const childPrices = [];
  let alerts = [];

  const isPricePerPerson = serviceData.priceperson || false;
  let basePrice = serviceData.price_pp || 0;

  const specialDate = serviceData.special_dates.find(special => special.date === date);
  if (specialDate) {
    basePrice += parseFloat(specialDate.price_add);
    alerts.push(`Precio especial aplicado para la fecha ${specialDate.date}.`);
  }

  function calculateFinalPrice(paxCount) {
    let totalPriceForAdults = 0;
    let totalPriceForChildren = 0;
    let messages = [];

    children_ages.forEach(age => {
      const childRate = serviceData.child_rate.find(rate => {
        if (rate.upTo === null) return false;
        return age <= rate.upTo;
      });

      if (childRate) {
        totalPriceForChildren += childRate.price_pp;
        messages.push(
          `Se considerÃ³ precio de niÃ±o para edad ${age} (hasta ${childRate.upTo} aÃ±os).`
        );
      } else {
        totalPriceForAdults += basePrice;
        messages.push(
          `Se considerÃ³ tarifa de adulto para edad ${age} (no aplica tarifa de niÃ±o).`
        );
      }
    });

    const numAdults = paxCount - children_ages.length;
    if (numAdults > 0) {
      totalPriceForAdults += numAdults * basePrice;
      messages.push(`Se considerÃ³ tarifa de adulto para ${numAdults} persona(s).`);
    }

    return {
      totalPriceForAdults,
      totalPriceForChildren,
      messages,
    };
  }

  number_paxs.forEach(paxCount => {
    if (!isPricePerPerson) {
      adultPrices.push(basePrice);
      childPrices.push(0);
      alerts.push(`Precio grupal para ${paxCount} persona(s): ${basePrice}.`);
    } else {
      const {
        totalPriceForAdults,
        totalPriceForChildren,
        messages,
      } = calculateFinalPrice(paxCount);

      adultPrices.push(totalPriceForAdults);
      childPrices.push(totalPriceForChildren);
      alerts = alerts.concat(messages);
    }
  });

  return {
    adultPrices,
    childPrices,
    alerts,
  };
}

function calculateVehiclePrice(serviceData, number_paxs) {
  return number_paxs.map(numPax => {
    let total = 0;
    let selectedVehicle = null;

    if (numPax >= 1 && numPax <= 3) {
      selectedVehicle = serviceData.type_vehicle.find(
        vehicle => vehicle.name_type_vehicle === 'CAMIONETA/VW TRANSPORTER /TOYOTA HIACE 01 - 03'
      );
    } else if (numPax >= 4 && numPax <= 7) {
      selectedVehicle = serviceData.type_vehicle.find(
        vehicle => vehicle.name_type_vehicle === 'VW CRAFTER 04 - 07'
      );
    } else if (numPax >= 8 && numPax <= 15) {
      selectedVehicle = serviceData.type_vehicle.find(
        vehicle => vehicle.name_type_vehicle === 'SPRINTER MB 08 - 15/VW CRAFTER DLX 4 PAX'
      );
    } else if (numPax >= 16 && numPax <= 25) {
      selectedVehicle = serviceData.type_vehicle.find(
        vehicle => vehicle.name_type_vehicle === 'MINIBUS 16 - 25'
      );
    }

    if (selectedVehicle) {
      total = selectedVehicle.price;
    }

    return total;
  });
}

function calculateOperatorsPrice(serviceData, number_paxs) {
  const { prices } = serviceData;
  return number_paxs.map(paxs => {
    const priceData = prices.find(price => paxs >= price.range_min && paxs <= price.range_max);
    return priceData ? priceData.price : null;
  });
}

function calculateTrainsPrices(serviceData, number_paxs, children_ages) {
  const { prices } = serviceData;
  const { adultPrice, childPrice } = prices;

  const calculatedPrices = number_paxs.map(paxs => {
    const number_of_children = Math.min(children_ages.length, paxs);
    const number_of_adults = paxs - number_of_children;
    return (number_of_children * childPrice) + (number_of_adults * adultPrice);
  });

  return calculatedPrices;
}

function calculateExtraPrice(serviceData, number_paxs) {
  const isPricePerPerson = serviceData.priceperson;
  const price = serviceData.price;
  let total = 0;

  return number_paxs.map(numPax => {
    if (!isPricePerPerson) {
      total = price * numPax;
    } else {
      return total;
    }
    return total;
  });
}
