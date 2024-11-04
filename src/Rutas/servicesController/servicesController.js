const EntranceService  = require('../../models/entrances.schema');
const OperatorService  = require('../../models/operators.schema');
const ExpeditionService = require('../../models/expeditions.schema')
const ExperienceService = require('../../models/experience.schema')
const GourmetService = require('../../models/gourmet.schema')
const GuideService = require('../../models/guides.schema')
const RestaurantService = require('../../models/Restaurant.schema')

exports.getServicePrices = async (req, res) => {
    try {
      const { services ,children_ages ,number_paxs , date,city} = req.body; // array de servicios seleccionados
      const results = [];
  
      for (const service of services) {
        const { service_id, service_type} = service;
        let serviceData;
  
        // Condiciones según `service_type`
        switch (service_type) {
          
  
          case 'entrance':
            // Consulta en la colección EntranceService
            serviceData = await EntranceService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateEntrancePrice(serviceData,children_ages,number_paxs);
              results.push({
                city:city,
            
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
                city:city,
           
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
                  city:city,
             
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
                  city:city,
               
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
                city:city,
           
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
                city:city,
               
                name_service: serviceData.name,
                price_base: calculatedPrice[0],
                prices: calculatedPrice,
              });
            }
            
          break; 
          // case 'operator':
          //   // Consulta en la colección OperatorService
          //   serviceData = await OperatorService.findById(service_id);
          //   if (serviceData) {
          //     const calculatedPrice = calculateOperatorPrice(serviceData);
          //     results.push({
          //       service_id,
          //       name: serviceData.name,
          //       price: calculatedPrice,
          //       date: serviceData.date,
          //       day: serviceData.day,
          //       notes: serviceData.notes || 'N/A',
          //     });
          //   }
          //   break;

          // Agrega más casos según los `service_type` y sus respectivas colecciones
          default:
            console.log(`Tipo de servicio desconocido: ${service_type}`);
        }
      }
  
      res.status(200).json({services:results,date:date});
    } catch (error) {
      console.error('Error obteniendo precios de servicios:', error);
      res.status(500).json({ message: 'Error al obtener precios de servicios' });
    }
  };
  
  // Funciones auxiliares para calcular precios según el tipo de servicio
  function calculateOperatorPrice(serviceData) {
    // Aplica tus condiciones de cálculo específicas para operadores
    return serviceData.basePrice * 1.1; // Ejemplo simple, ajusta según tu lógica
  }
  
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

  // Funciones auxiliares para calcular precios según el tipo de servicio
  function calculateExpeditionPrice(serviceData,number_paxs) {
      const pricePerPerson = serviceData.price_pp;
  
      // Multiplica el precio por persona por cada valor en `number_paxs`
      return number_paxs.map(numPax => pricePerPerson * numPax);
  }


  function calculateExperiencePrice(serviceData,number_paxs) {
  // Array para almacenar los precios totales de cada grupo de pasajeros
  return number_paxs.map(numPax => {
    // Busca en `prices` el precio que corresponde al tamaño del grupo `numPax`
    const priceInfo = serviceData.prices.find(price => price.groupSize === numPax);
    
    // Si se encuentra un precio para ese tamaño de grupo, devuélvelo; si no, devuelve null o un valor predeterminado
    return priceInfo ? priceInfo.pricePerPerson : null;
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

        // Precio general y posibles precios especiales
    const generalPrice = serviceData.price_pp || 0;
    let finalPrice = generalPrice;

    // Revisar si la fecha coincide con una fecha especial
    serviceData.special_dates.forEach(s => {
        if(s.date=== date){
          finalPrice=s.price_add;
        }
    })
    // const specialDate = serviceData.special_dates.find(s => s.date === date);
    // if (specialDate) {
    //     finalPrice = specialDate.price_add;
    // }

    // Verificar precios de niño según la edad
    children_ages.forEach(age => {
        serviceData.child_rate.forEach(childRate => {
            if (childRate.upTo !== null && age <= childRate.upTo) {
                finalPrice = Math.min(finalPrice, childRate.price_pp); // Toma el precio de niño si es menor
            }
        });
    });

    // Calcular el precio total multiplicado por cada número en number_paxs usando map
    return number_paxs.map(paxCount => finalPrice * paxCount);
    }