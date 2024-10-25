const EntranceService  = require('../../models/entrances.schema');
const OperatorService  = require('../../models/operators.schema');

exports.getServicePrices = async (req, res) => {
    try {
      const { services ,age } = req.body; // array de servicios seleccionados
      const results = [];
  
      for (const service of services) {
        const { service_id, service_type} = service;
        let serviceData;
  
        // Condiciones según `service_type`
        switch (service_type) {
          case 'operator':
            // Consulta en la colección OperatorService
            serviceData = await OperatorService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateOperatorPrice(serviceData);
              results.push({
                service_id,
                name: serviceData.name,
                price: calculatedPrice,
                date: serviceData.date,
                day: serviceData.day,
                notes: serviceData.notes || 'N/A',
              });
            }
            break;
  
          case 'entrance':
            // Consulta en la colección EntranceService
            serviceData = await EntranceService.findById(service_id);
            if (serviceData) {
              const calculatedPrice = calculateEntrancePrice(serviceData,age);
              results.push({
                name: serviceData.description,
                price: calculatedPrice,
              });
            }
            break;
  
          // Agrega más casos según los `service_type` y sus respectivas colecciones
          default:
            console.log(`Tipo de servicio desconocido: ${service_type}`);
        }
      }
  
      res.status(200).json(results);
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
  
  function calculateEntrancePrice(serviceData,age) {
    // Aplica tus condiciones de cálculo específicas para entradas
    if(age >= serviceData.childRate.upTo){
        return serviceData.price_pp
    }else{
        return serviceData.childRate.pp
    }
    
  }