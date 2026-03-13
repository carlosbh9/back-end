const express = require('express');

const router = express.Router();
const MasterQuoter = require('../../models/master-quoter.schema');
const {
  findTariffByTypeAndId,
  findNestedTariffService,
} = require('../../utils/tariffResolver');

async function resolveMasterService(service) {
  if (!service?.service_type || !service?.service_id) {
    return null;
  }

  if (service.service_type === 'operator') {
    const operatorResult = await findNestedTariffService(
      'operator',
      service.service_id,
      service.operator_service_id,
      'servicios'
    );

    if (!operatorResult?.parentDoc || !operatorResult?.nestedDoc) {
      return null;
    }

    return {
      type: 'operator',
      operator: operatorResult.parentDoc.operador,
      city: operatorResult.parentDoc.ciudad,
      service: operatorResult.nestedDoc,
    };
  }

  if (service.service_type === 'train') {
    const trainResult = await findNestedTariffService(
      'train',
      service.service_id,
      service.train_service_id,
      'services'
    );

    if (!trainResult?.parentDoc || !trainResult?.nestedDoc) {
      return null;
    }

    return {
      type: 'train',
      train: trainResult.parentDoc.company,
      service: trainResult.nestedDoc,
    };
  }

  if (service.service_type === 'hotel') {
    const hotel = await findTariffByTypeAndId('hotel', service.service_id);
    if (!hotel) {
      return null;
    }

    const hotelServiceId = service.hotel_service_id || service.hotels_service_id;
    const hotelService = hotelServiceId ? hotel.services.id(hotelServiceId) : null;

    return {
      type: 'hotel',
      hotel: hotel.name,
      city: hotel.location,
      service: hotelService || hotel,
    };
  }

  const directService = await findTariffByTypeAndId(service.service_type, service.service_id);
  if (!directService) {
    return null;
  }

  return {
    type: service.service_type,
    data: directService,
  };
}

router.get('/:id', async (req, res) => {
  try {
    const option = await MasterQuoter.findById(req.params.id);

    if (!option) {
      return res.status(404).json({ message: 'Master Quoter no encontrada' });
    }

    const dayServicesDetails = [];

    for (const day of option.day) {
      const servicesDetails = [];

      for (const service of day.services) {
        const resolvedService = await resolveMasterService(service);
        if (resolvedService) {
          servicesDetails.push(resolvedService);
        }
      }

      dayServicesDetails.push({
        city: day.city,
        name_services: day.name_services,
        services: servicesDetails,
      });
    }

    res.json({
      name: option.name,
      destinations: option.destinations,
      day: dayServicesDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la Master Quoter' });
  }
});

router.post('/', async (req, res) => {
  try {
    const newMasterQuoter = new MasterQuoter(req.body);
    await newMasterQuoter.save();

    res.status(201).json({
      message: 'Master Quoter creada exitosamente',
      data: newMasterQuoter,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear la Master Quoter' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deletedOption = await MasterQuoter.findByIdAndDelete(req.params.id);
    if (!deletedOption) {
      return res.status(404).json({ message: 'Master Quoter no encontrada' });
    }
    res.status(200).json({ message: 'Master Quoter eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar Master Quoter', error });
  }
});

router.get('/', async (req, res) => {
  try {
    const options = await MasterQuoter.find()
      .select('_id name type days day destinations')
      .sort({ type: 1, name: 1 });

    res.status(200).json(options);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los Master Quoter', error });
  }
});

router.get('/edit/:id', async (req, res) => {
  try {
    const options = await MasterQuoter.findById(req.params.id);
    res.status(200).json(options);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los Master Quoter', error });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const updatedOption = await MasterQuoter.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedOption) {
      return res.status(404).json({ message: ' Master Quoter no encontrada' });
    }

    res.status(200).json(updatedOption);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar  Master Quoter', error });
  }
});

module.exports = router;
