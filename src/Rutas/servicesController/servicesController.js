const EntranceService  = require('../../models/entrances.schema');
const OperatorService  = require('../../models/operators.schema');
const ExpeditionService = require('../../models/expeditions.schema')
const ExperienceService = require('../../models/experience.schema')
const GourmetService = require('../../models/gourmet.schema')
const GuideService = require('../../models/guides.schema')
const RestaurantService = require('../../models/Restaurant.schema')
const TransportService = require('../../models/transport.schema')
const TrainService = require('../../models/train.schema')

exports.getServicePrices = async (req, res) => {
    try {
      const { services ,children_ages ,number_paxs , date} = req.body; // array de servicios seleccionados
      const results = [];
  
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
              results.push({
                city:service.city,
            
                name_service: serviceData.description,
                price_base: calculatedPrice[0],
                prices: calculatedPrice,
              });
            }
            break;
            
          case 'expeditions':
            serviceData = await ExpeditionService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateExpeditionPrice(serviceData,number_paxs);
              results.push({
                city:service.city,
           
                name_service: serviceData.name,
                price_base: calculatedPrice[0],
                prices: calculatedPrice,
              });
            }

            break;

          case 'experience':
              serviceData = await ExperienceService.findById(service_id);
              if (serviceData) {
                const calculatedPrice = calculateExperiencePrice(serviceData,number_paxs);
                results.push({
                  city:service.city,
             
                  name_service: serviceData.name,
                  price_base: calculatedPrice[0],
                  prices: calculatedPrice,
                });
              }
  
              break;
          case 'gourmet':
              serviceData = await GourmetService.findById(service_id);
              if (serviceData) {
                const calculatedPrice = calculateGourmetPrice(serviceData,children_ages,number_paxs);
                results.push({
                  city:service.city,
               
                  name_service: serviceData.activitie,
                  price_base: calculatedPrice[0],
                  prices: calculatedPrice,
                });
              }
          break; 

          case 'guides':
            serviceData = await GuideService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateGuidePrice(serviceData,children_ages,number_paxs,date);
            
              results.push({
                city:service.city,
           
                name_service: serviceData.name_guide,
                price_base: calculatedPrice[0],
                prices: calculatedPrice,
              });
            }
            
          break;     
          case 'restaurant':
            serviceData = await RestaurantService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateRestaurantPrice(serviceData,children_ages,number_paxs,date);
              results.push({
                city:service.city,
                name_service: serviceData.name,
                price_base: calculatedPrice[0],
                prices: calculatedPrice,
              });
            }
            break;
            case 'transport':
            serviceData = await TransportService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateVehiclePrice(serviceData,number_paxs);
              results.push({
                city:service.city,
                name_service: serviceData.nombre,
                price_base: calculatedPrice[0],
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
              results.push({
                 city:service.city,
                  name_service: serviceData.descripcion,
                  price_base: calculatedPrice[0],
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
                results.push({
                    city:service.city,
                    name_service: serviceData.serviceName,
                    price_base: calculatedPrice[0],
                    prices: calculatedPrice,
                });
              }
              break;
            
          // Agrega más casos según los `service_type` y sus respectivas colecciones
          default:
            console.log(`Tipo de servicio desconocido: ${service_type}`);
        }
      }
  
      res.status(200).json({services:results,date:date});
    } catch (error) {
      console.error('Error obteniendo precios de servicios:', error);
      res.status(500).json({ message: 'Error al obtener precios de servicios'+error });
    }
  };
  

  
  function calculateEntrancePrice(serviceData,children_ages,number_paxs) {
     // Extrae los precios y límites de edad
  const childPrice = serviceData.childRate.pp;
  const adultPrice = serviceData.price_pp;
  const maxChildAge = serviceData.childRate.upTo;

  // Mapea cada cantidad en `number_paxs` para calcular el precio total correspondiente
  return number_paxs.map(numPax => {
    let totalPrice = 0;
    let numChildren = 0;

    // Asigna el precio de niños hasta el límite de edad especificado
    children_ages.forEach(age => {
      if (age <= maxChildAge && numChildren < numPax) {
        totalPrice += childPrice;
        numChildren++;
      }
    });

    // Calcula el precio para los adultos restantes
    const numAdults = numPax - numChildren;
    totalPrice += numAdults * adultPrice;

    return totalPrice;
  });
    
  }

  function calculateExpeditionPrice(serviceData,number_paxs) {
      const pricePerPerson = serviceData.price_pp;
  
      // Multiplica el precio por persona por cada valor en `number_paxs`
      return number_paxs.map(numPax => pricePerPerson * numPax);
  }

  function calculateExperiencePrice(serviceData,number_paxs,children_ages) {
    const isPricePerPerson = serviceData.priceperson; // Determinar si es por persona o grupo
    const childRate = serviceData.childRate;
  
    return number_paxs.map(numPax => {
      const priceInfo = serviceData.prices.find(price => price.groupSize === numPax);
      if (!priceInfo) return 0;
  
      if (!isPricePerPerson) {
        return priceInfo.pricePerPerson;
      } else {
        let totalPrice = 0;
  
        // Asegurarse de que children_ages sea un array
        (children_ages || []).forEach(age => {
          if (age >= childRate.minimumAge && age <= childRate.upTo) {
            alert(`La edad ${age} no cumple con la edad mínima de ${childRate.minimumAge} años para aplicar el precio de niño.`);
            totalPrice += childRate.pp || priceInfo.pricePerPerson;
          } else {
            totalPrice += priceInfo.pricePerPerson;
          }
        });
  
        const numAdults = numPax - (children_ages ? children_ages.length : 0);
        totalPrice += numAdults * priceInfo.pricePerPerson;
  
        return totalPrice;
      }
    });
 }

  function calculateGourmetPrice(serviceData,children_ages,number_paxs) {
    return number_paxs.map(numPax => {
      let total = 0;
  
      if (numPax === 1) {
        // Si solo es un pasajero, usa `price_for_one_person`
        total = serviceData.price_for_one_person;
      } else {
        // Para más de un pasajero, aplica `childRate` y `price_pp`
        children_ages.slice(0, numPax).forEach(age => {
          if (age >= serviceData.childRate.from && age <= serviceData.childRate.upTo) {
            total += serviceData.childRate.price;
          } else {
            total += serviceData.price_pp;
          }
        });
  
        // Para el resto de pasajeros (adultos)
        const adultsCount = numPax - children_ages.length;
        if (adultsCount > 0) {
          total += adultsCount * serviceData.price_pp;
        }
      }
  
      return total;
    });
  }

  function calculateGuidePrice(serviceData,children_ages,number_paxs,date) {
      return number_paxs.map(numPax => {
        let total = 0;

        // Determinar el número de niños y adultos
        const childCount = children_ages.filter(age => age <= 12).length; // Niños menores de 12
        const adultCount = numPax - childCount;

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
        if (childCount >= 3) {
            total += (0.5 * serviceData.price_guide); // Guía asistente al 50%
        }

        // Aplicar recargo del 50% en fechas específicas
        const surchargeDates = [
            '2024-05-01', // 01 Mayo
            '2024-07-28', // 28 Julio
            '2024-07-29', // 29 Julio
            '2024-12-25', // 25 Diciembre
            '2024-01-01'  // 01 Enero
        ];

        if (surchargeDates.includes(date)) {
            total *= 1.5; // Aplicar recargo del 50%
        }

        return total;
    });
  }

  function calculateRestaurantPrice(serviceData,children_ages,number_paxs,date) {

      const isPricePerPerson = serviceData.priceperson || false; // Determina si es precio por persona o grupal
      let basePrice = serviceData.price_pp || 0;
    
      // Verificar si la fecha coincide con una fecha especial y ajustar el precio base
      const specialDate = serviceData.special_dates.find(special => special.date === date);
      if (specialDate) {
        basePrice += parseFloat(specialDate.price_add); // Suma el precio especial si aplica
      }
    
      // Determinar el precio final considerando niños
      function calculateFinalPrice(paxCount) {
        let totalPrice = 0;
    
        // Procesar precios para niños primero
        children_ages.forEach(age => {
          const childRate = serviceData.child_rate.find(rate => rate.upTo !== null && age <= rate.upTo);
          if (childRate) {
            totalPrice += childRate.price_pp; // Precio para niños dentro del rango
          } else {
            alert(`La edad ${age} no cumple con el rango de precios para niños. Aplicando precio de adulto.`);
            totalPrice += basePrice; // Precio de adulto si no aplica el precio de niño
          }
        });
    
        // Calcular el precio para los adultos restantes
        const numAdults = paxCount - children_ages.length;
        if (numAdults > 0) {
          totalPrice += numAdults * basePrice;
        }
    
        return totalPrice;
      }
    
      // Procesar precios según si es por persona o grupal
      return number_paxs.map(paxCount => {
        if (isPricePerPerson) {
          return calculateFinalPrice(paxCount); // Precio por persona
        } else {
          return basePrice; // Precio grupal (mismo para todos los tamaños de grupo)
        }
      });
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