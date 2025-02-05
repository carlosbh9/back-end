const EntranceService  = require('../../models/entrances.schema');
const OperatorService  = require('../../models/operators.schema');
const ExpeditionService = require('../../models/expeditions.schema')
const ExperienceService = require('../../models/experience.schema')
const GourmetService = require('../../models/gourmet.schema')
const GuideService = require('../../models/guides.schema')
const RestaurantService = require('../../models/Restaurant.schema')
const TransportService = require('../../models/transport.schema')
const TrainService = require('../../models/train.schema')
const ExtraService = require('../../models/extras.schema')
const { RestrictionError } = require('../../utils/errors')

exports.getServicePrices = async (req, res) => {
    try {
      const { services ,children_ages ,number_paxs , date} = req.body; // array de servicios seleccionados
      const results = [];
      let globalAlerts = [];
  
      for (const service of services) {
        const { service_id, service_type,operator_service_id,train_service_id} = service;
        let serviceData;
  
        // Condiciones según `service_type`
        switch (service_type) {
          case 'entrance':
            // Consulta en la colección EntranceService
            serviceData = await EntranceService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateEntrancePrice(serviceData,children_ages,number_paxs);
              const calculatePricebase=calculateEntrancePrice(serviceData,[],[1]);
              globalAlerts.push(...calculatedPrice.alerts);
              results.push({
                city:service.city,
                day: service.day,
                name_service: serviceData.description,
                price_base: calculatePricebase.adultPrices[0],
                prices: calculatedPrice.adultPrices,
                
              });
              if (calculatedPrice.childPrices[0] > 0) {
                results.push({
                  city: service.city,
                  day: service.day,
                  name_service: `${serviceData.description} KIDS`, // Agregamos "kids" al nombre del servicio
                  price_base: 0 ,  // Precio base para adultos
                  prices: calculatedPrice.childPrices,  // Precios solo para niños
                });
              }
            }
            break;
          case 'expeditions':
            serviceData = await ExpeditionService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateExpeditionPrice(serviceData,number_paxs);
              const calculatePricebase=calculateExpeditionPrice(serviceData,[1]);
              results.push({
                city:service.city,
                day: service.day,
                name_service: serviceData.name,
                price_base: calculatePricebase[0],
                prices: calculatedPrice,
              });
            }
            break;
          case 'experience':
              serviceData = await ExperienceService.findById(service_id);
              if (serviceData) {
                try {
                const calculatedPrice = calculateExperiencePrice(serviceData,number_paxs,children_ages);
                const calculatePricebase=calculateExperiencePrice(serviceData,[1]);
                results.push({
                  city:service.city,
                  day: service.day,
                  name_service: serviceData.name,
                  price_base: calculatePricebase[0],
                  prices: calculatedPrice,
                });
              }catch (error) {
                if (error instanceof RestrictionError) {
                  return res.status(400).json({ 
                    message: error.message 
                  });
                } else {
                  throw error;
                }
              }
              }
              break;
          case 'gourmet':
              serviceData = await GourmetService.findById(service_id);
              if (serviceData) {
                const calculatedPrice = calculateGourmetPrice(serviceData,children_ages,number_paxs);
                const calculatePricebase=calculateGourmetPrice(serviceData,[],[1]);

                results.push({
                  city:service.city,
                  day: service.day,
                  name_service: serviceData.activitie,
                  price_base: calculatePricebase.adultPrices[0],
                  prices: calculatedPrice.adultPrices,
                });

                if (calculatedPrice.childPrices[0] > 0) {
                  results.push({
                    city: service.city,
                    day: service.day,
                    name_service: `${serviceData.activitie} KIDS`, // Agregamos "kids" al nombre del servicio
                    price_base: 0 ,  // Precio base para adultos
                    prices: calculatedPrice.childPrices,  // Precios solo para niños
                  });
                }
              }
          break; 

          case 'guides':
            serviceData = await GuideService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateGuidePrice(serviceData,number_paxs,date);
              const calculatePricebase = calculateGuidePrice(serviceData,[1],date);
              globalAlerts = [...globalAlerts, ...calculatedPrice.alerts];
              results.push({
                city:service.city,
                day: service.day,
                name_service: serviceData.name_guide,
                price_base: calculatePricebase.totalPrice[0],
                prices: calculatedPrice.totalPrice,
              });
            }
            
          break;     
          case 'restaurant':
            serviceData = await RestaurantService.findById(service_id);
            if (serviceData) {
              const  calculatedPrice  = calculateRestaurantPrice(serviceData,children_ages,number_paxs,date);
              const   calculatePricebase =calculateRestaurantPrice(serviceData,children_ages,[1],date);
              globalAlerts = [...globalAlerts, ...calculatedPrice.alerts];
              results.push({
                city:service.city,
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
                  price_base: 0 ,
                  prices: calculatedPrice.childPrices,  
                });
              }
            }
            break;
            case 'transport':
            serviceData = await TransportService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateVehiclePrice(serviceData,number_paxs);
              const calculatePricebase=calculateVehiclePrice(serviceData,[1]);

              results.push({
                city:service.city,
                day: service.day,
                name_service: serviceData.nombre,
                price_base: calculatePricebase[0],
                prices: calculatedPrice,
              });
            }
            break;
          case 'operator':
            const operatorData = await OperatorService.findOne(
              { _id: service_id , 'servicios._id': operator_service_id }, // Filtro por el operador y el subservicio
              { 'servicios.$': 1 } // Proyección: selecciona solo el servicio coincidente
          );
          // Extraer el subservicio directamente
           serviceData = operatorData?.servicios?.[0];
            
            if (serviceData) {
              const calculatedPrice = calculateOperatorsPrice(serviceData,number_paxs);
              const calculatePricebase=calculateOperatorsPrice(serviceData,[1]);

              results.push({
                  city:service.city,
                  day: service.day,
                  name_service: serviceData.descripcion,
                  price_base: calculatePricebase[0],
                  prices: calculatedPrice,
              });
            }
            break;
            case 'train':
              const TrainData = await TrainService.findOne(
                { _id: service_id , 'services._id': train_service_id }, // Filtro por el operador y el subservicio
                { 'services.$': 1 } // Proyección: selecciona solo el servicio coincidente
            );
            // Extraer el subservicio directamente
             serviceData = TrainData?.services?.[0];
              
              if (serviceData) {
                const calculatedPrice = calculateTrainsPrices(serviceData,number_paxs,children_ages);
                const calculatePricebase=calculateTrainsPrices(serviceData,[1],children_ages);

                results.push({
                    city:service.city,
                    day: service.day,
                    name_service: serviceData.serviceName,
                    price_base: calculatePricebase[0],
                    prices: calculatedPrice,
                });
              }
              break;

            case 'extra': 
                serviceData = await ExtraService.findById(service_id);
                if (serviceData) {
                  const calculatedPrice = calculateExtraPrice(serviceData,number_paxs);
                  const calculatePricebase=calculateExtraPrice(serviceData,[1]);
                  results.push({
                    city:service.city,
                    day: service.day,
                    name_service: serviceData.name,
                    price_base: calculatePricebase[0],
                    prices: calculatedPrice
                  });
                }
            
          break;   
          // Agrega más casos según los `service_type` y sus respectivas colecciones
          default:
            console.log(`Tipo de servicio desconocido: ${service_type}`);
        }
      }
  
      res.status(200).json({services:results,date:date,alerts: globalAlerts});
    } catch (error) {
      console.error('Error obteniendo precios de servicios:', error);
      res.status(500).json({ message: 'Error al obtener precios de servicios'+error });
    }
  };
  

 

  function calculateEntrancePrice(serviceData, children_ages, number_paxs) {
    // Asumiendo que el servicio tiene precios diferenciados para niños y adultos
    const childPrice = serviceData.childRate ? serviceData.childRate.pp : 0;
    const adultPrice = serviceData.price_pp;
    const maxChildAge = serviceData.childRate ? serviceData.childRate.upTo : 0;
  
    // Inicializamos arrays para almacenar los precios de niños y adultos
    const childPrices = [];
    const adultPrices = [];
    const alerts = [];
 
    // Mapea cada cantidad en `number_paxs` para calcular el precio total correspondiente
    number_paxs.forEach(numPax => {
      let totalChildPrice = 0;
      let totalAdultPrice = 0;
      let numChildren = 0;
  
   
      // Asigna el precio de niños hasta el límite de edad especificado
      children_ages.forEach(age => {
        if (age <= maxChildAge && numChildren < numPax) {
          totalChildPrice += childPrice;  // Sumar precio para niños
          numChildren++;
          alerts.push(`Niño con edad ${age} tomó precio de niño $ ${childPrice}.00`);
        }
      });
  
      // Calcula el precio para los adultos restantes
      const numAdults = numPax - numChildren;
      totalAdultPrice += numAdults * adultPrice;  // Sumar precio para adultos
  
      // Agregamos los precios de niños y adultos a sus respectivos arrays
      childPrices.push(totalChildPrice);
      adultPrices.push(totalAdultPrice);
    });
  
    // Retorna ambos arrays: precios de niños y precios de adultos
    return { childPrices, adultPrices, alerts };
  }
  
  
  
  
  function calculateExpeditionPrice(serviceData,number_paxs) {
      const pricePerPerson = serviceData.price_pp;
      const isPricePerPerson = serviceData.priceperson
      return number_paxs.map(numPax => {
        return isPricePerPerson ? pricePerPerson * numPax: pricePerPerson ;
      });
  }

  function calculateExperiencePrice(serviceData,number_paxs,children_ages) {
    const isPricePerPerson = serviceData.priceperson; 
    const childRate = serviceData.childRate;
  
    return number_paxs.map(numPax => {
      const priceInfo = serviceData.prices.find(price => price.groupSize === numPax);
      if (!priceInfo) return 0;
  
      if (!isPricePerPerson) {
        return priceInfo.pricePerPerson;
      } else {
        let totalPrice = 0;
  
        (children_ages || []).forEach(age => {
          if (age < childRate.minimumAge) {
            throw new RestrictionError(`La edad ${age} es menor a la edad mínima (${childRate.minimumAge}) para esta experiencia.`);
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
      }
    });
 }

  function calculateGourmetPrice(serviceData,children_ages,number_paxs) {
      const childPrices = [];
      const adultPrices = [];
    number_paxs.map(numPax => {
      let total = 0;
      let totalChildPrice = 0;
      let totalAdultPrice = 0;

      if (numPax === 1) {
        // Si solo es un pasajero, usa `price_for_one_person`
        totalAdultPrice = serviceData.price_for_one_person;
      } else {
        // Para más de un pasajero, aplica `childRate` y `price_pp`
        children_ages.slice(0, numPax).forEach(age => {
          if (age >= serviceData.childRate.from && age <= serviceData.childRate.upTo) {
            totalChildPrice += serviceData.childRate.price;
          } else {
            totalChildPrice += serviceData.price_pp;
          }
        });
  
        // Para el resto de pasajeros (adultos)
        const adultsCount = numPax - children_ages.length;
        if (adultsCount > 0) {
          totalAdultPrice += adultsCount * serviceData.price_pp;
        }

      }
  
      //return total;
      childPrices.push(totalChildPrice);
      adultPrices.push(totalAdultPrice);
      //return { childPrices, adultPrices };
    });
    return { childPrices, adultPrices };
  }

  function calculateGuidePrice(serviceData,number_paxs,date) {
      const totalPrice = []
      let alerts  = [];
     number_paxs.map(numPax => {
        let total = 0;
       
        // Determinar el número de niños y adultos
        // const childCount = children_ages.filter(age => age <= 12).length; // Niños menores de 12
        // const adultCount = numPax - childCount;

        // Determinar el precio base según el número de pasajeros (1 a 9)
        let basePrice = 0;
        if (numPax === 1) {
            basePrice = serviceData.price_guide; // Precio para un solo pasajero
        } else if (numPax <= 9) {
            basePrice = serviceData.price_guide; // Precio base para 1 a 9 pasajeros
        } else {
            // Para más de 9 pasajeros, puedes implementar tu lógica aquí
            const additionalGuides = Math.ceil((numPax - 9) / 9); // Cada 9 pasajeros adicionales
            basePrice = serviceData.price_guide * (1 + additionalGuides); // Precio total incluyendo guías adicionales
        }

        total += basePrice;

        // Considerar guía asistente si hay 3 o más niños menores de 12 años
        // if (childCount >= 3) {
        //     total += (0.5 * serviceData.price_guide); // Guía asistente al 50%
        // }

        // Aplicar recargo del 50% en fechas específicas
        const surchargeDates = [
            '2025-05-01', // 01 Mayo
            '2025-07-28', // 28 Julio
            '2025-07-29', // 29 Julio
            '2025-12-25', // 25 Diciembre
            '2025-01-01'  // 01 Enero
        ];

        if (surchargeDates.includes(date)) {
            total *= 1.5; // Aplicar recargo del 50%
            alerts.push('Aplicar recargo del 50% por fechas especificas')
        }
        totalPrice.push(total)
       // return {total, message};
    });

    return {totalPrice, alerts};
  }



  function calculateRestaurantPrice(serviceData, children_ages, number_paxs, date) {
    const adultPrices = [];  // Arreglo para precios de adultos (por grupo)
    const childPrices = [];  // Arreglo para precios de niños (por grupo)
    let alerts = [];
  
    // Verifica si es precio por persona o precio grupal
    const isPricePerPerson = serviceData.priceperson || false;
  
    // Iniciamos el precio base
    let basePrice = serviceData.price_pp || 0;
  
    // 1. Revisar si la fecha es especial => agregar price_add
    const specialDate = serviceData.special_dates.find(special => special.date === date);
    if (specialDate) {
      basePrice += parseFloat(specialDate.price_add);
      alerts.push(`Precio especial aplicado para la fecha ${specialDate.date}.`);
    }
  
    function calculateFinalPrice(paxCount) {
      let totalPriceForAdults = 0;
      let totalPriceForChildren = 0;
      let messages = [];
  
      // Recorremos cada edad de niño para asignar su tarifa
      children_ages.forEach(age => {
        // Busca si hay un child_rate cuyo 'upTo' cubra esta edad
        //   por ejemplo: { price_pp: 34, upTo: 10 }
        const childRate = serviceData.child_rate.find(rate => {
          if (rate.upTo === null) return false;
          return age <= rate.upTo;
        });
  
        if (childRate) {
          // Suma la tarifa de niño
          totalPriceForChildren += childRate.price_pp;
          messages.push(
            `Se consideró precio de niño para edad ${age} (hasta ${childRate.upTo} años).`
          );
        } else {
          // Si no hay tarifa de niño aplicable, cobramos como adulto
          totalPriceForAdults += basePrice;
          messages.push(
            `Se consideró tarifa de adulto para edad ${age} (no aplica tarifa de niño).`
          );
        }
      });
  
      // El resto (paxCount - niños) se consideran adultos
      const numAdults = paxCount - children_ages.length;
      if (numAdults > 0) {
        totalPriceForAdults += numAdults * basePrice;
        messages.push(
          `Se consideró tarifa de adulto para ${numAdults} persona(s).`
        );
      }
  
      return {
        totalPriceForAdults,
        totalPriceForChildren,
        messages
      };
    }
  
    // 2. Iterar sobre cada valor de 'number_paxs'
    //    - Si es price per person => usamos 'calculateFinalPrice'
    //    - Si es precio grupal => solo cobra 'basePrice' (y no diferencia niños/adultos)
    number_paxs.forEach(paxCount => {
      if (!isPricePerPerson) {
        // Precio grupal
        // a) Todos pagan lo mismo => no hay distinción de niños/adultos
        adultPrices.push(basePrice);
        childPrices.push(0);
        alerts.push(
          `Precio grupal para ${paxCount} persona(s): ${basePrice}.`
        );
      } else {
        // Precio por persona => calculamos niños y adultos por separado
        const { 
          totalPriceForAdults, 
          totalPriceForChildren, 
          messages 
        } = calculateFinalPrice(paxCount);
  
        adultPrices.push(totalPriceForAdults);
        childPrices.push(totalPriceForChildren);
  
        // Unimos los mensajes de este grupo en nuestro array general de alertas
        alerts = alerts.concat(messages);
      }
    });
  
    // 3. Retornamos el resultado global
    return {
      adultPrices,
      childPrices,
      alerts
    };
}


  function calculateVehiclePrice(serviceData, number_paxs) {
      return number_paxs.map(numPax => {
          let total = 0;
  
          // Determina el tipo de vehículo que corresponde según el número de pasajeros
          let selectedVehicle = null;
  
          if (numPax >= 1 && numPax <= 3) {
              selectedVehicle = serviceData.type_vehicle.find(vehicle => vehicle.name_type_vehicle === "CAMIONETA/VW TRANSPORTER /TOYOTA HIACE 01 - 03");
          } else if (numPax >= 4 && numPax <= 7) {
              selectedVehicle = serviceData.type_vehicle.find(vehicle => vehicle.name_type_vehicle === "VW CRAFTER 04 - 07");
          } else if (numPax >= 8 && numPax <= 15) {
              selectedVehicle = serviceData.type_vehicle.find(vehicle => vehicle.name_type_vehicle === "SPRINTER MB 08 - 15/VW CRAFTER DLX 4 PAX");
          } else if (numPax >= 16 && numPax <= 25) {
              selectedVehicle = serviceData.type_vehicle.find(vehicle => vehicle.name_type_vehicle === "MINIBUS 16 - 25");
          }
  
          // Si encontramos el vehículo adecuado, sumamos su precio
          if (selectedVehicle) {
              total = selectedVehicle.price;
          }
  
          return total;
      });
  }
  function calculateOperatorsPrice(serviceData, number_paxs) {
      const { prices } = serviceData;
      return number_paxs.map((paxs) => {
        // Encuentra el rango que corresponde al número de pasajeros
        const priceData = prices.find(price => paxs >= price.range_min && paxs <= price.range_max);

        // Retorna el precio encontrado, si no hay un rango, retorna null o un mensaje
        return priceData ? priceData.price : null; // Puedes cambiar `null` por un valor predeterminado
    });

  }

  function calculateTrainsPrices(serviceData, number_paxs,children_ages) {
    const { prices } = serviceData;
    const { adultPrice, childPrice } = prices;

    // Mapea el array de pasajeros para calcular el precio
    const calculatedPrices = number_paxs.map((paxs) => {
        // Calcula el número de niños y adultos
        const number_of_children = Math.min(children_ages.length, paxs); // Máximo niños según pasajeros
        const number_of_adults = paxs - number_of_children; // Resto son adultos

        // Calcula el precio total
        const total_price = (number_of_children * childPrice) + (number_of_adults * adultPrice);

        return total_price; // Retorna el precio total para el número de pasajeros
    });

    return calculatedPrices;

  }


  function calculateExtraPrice(serviceData,number_paxs) {
    const isPricePerPerson = serviceData.priceperson;
    const price = serviceData.price
    let total = 0
    return number_paxs.map( numPax => {
      if (!isPricePerPerson) {
        total = price * numPax
      }else {
        return total
      }
      return total
    });
}