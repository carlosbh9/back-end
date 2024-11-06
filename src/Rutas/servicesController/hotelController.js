const HotelService = require('../../models/hotels.schema');

exports.getServicePrices = async (req, res) => {
  try {
    const { hotelId, serviceId, number_paxs, priceType, date } = req.body; // `priceType` será 'confidential' o 'rack'

    // 1. Obtener el hotel
    const hotel = await HotelService.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel no encontrado' });
    }

    // 2. Buscar el servicio específico dentro del hotel
    const service = hotel.services.find(s => s._id.toString() === serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Servicio no encontrado en el hotel' });
    }

    // 3. Calcular precios para cada número de pasajeros en `number_paxs`
    const prices = number_paxs.map(pax => calculateHotelPrice(hotel, service, pax, priceType, date));

    // 4. Formatear la respuesta
    const result = {
      name_hotel: hotel.name,
      accommodations_category: service.name_service,
      date: date,
      prices: prices
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Error obteniendo precios de servicios:', error);
    res.status(500).json({ message: 'Error al obtener precios de servicios' });
  }
};

// Función para calcular el precio total basado en el número de pasajeros, tipo de habitación y fecha especial
function calculateHotelPrice(hotel, service, pax, priceType, date) {
  let remainingPaxs = pax;
  let totalCost = 0;

  // Verificar si la fecha coincide con una fecha especial
  const specialDate = hotel.special_dates.find(s => s.date === date);
  const specialPrice = specialDate ? specialDate.price : null;

  for (const room of service.roomPrices) {
    let roomCount = 0;
    let maxPaxsPerRoom;

    // Determinar la capacidad de la habitación
    if (room.type === 'SWB') maxPaxsPerRoom = 1;
    else if (room.type === 'DWB') maxPaxsPerRoom = 2;
    else if (room.type === 'TRP') maxPaxsPerRoom = 3;

    // Calcular cuántas habitaciones de este tipo son necesarias
    while (remainingPaxs >= maxPaxsPerRoom) {
      roomCount++;
      remainingPaxs -= maxPaxsPerRoom;
    }

    // Agregar una habitación adicional si hay pasajeros restantes (aunque sean menos de la capacidad máxima)
    if (remainingPaxs > 0 && remainingPaxs <= maxPaxsPerRoom) {
      roomCount++;
      remainingPaxs = 0;
    }

    // Calcular el precio por habitación teniendo en cuenta el tipo de precio y la fecha especial
    const pricePerRoom = specialPrice || (priceType === 'confidential' ? room.confidential : room.rack);
    const roomTotalCost = pricePerRoom * roomCount;

    // Sumar al costo total
    totalCost += roomTotalCost;
  }

  return totalCost;
}
