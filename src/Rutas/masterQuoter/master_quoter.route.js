const express = require('express');
const router = express.Router();
const masterQuoter  = require('../../models/master-quoter.schema');

const Entrance = require('../../models/entrances.schema');
const Restaurant = require('../../models/Restaurant.schema');
const Operator = require('../../models/operators.schema');
const Expedition = require('../../models/expeditions.schema');
const Experience = require('../../models/experience.schema')
const Guide = require('../../models/guides.schema')
const Hotel = require('../../models/hotels.schema')
const Train = require('../../models/train.schema')
const Transport = require('../../models/transport.schema')


// GET: Obtener una Master Quoter con todos los servicios referenciados
router.get('/:id', async (req, res) => {
    try {
        const optionId = req.params.id;
        const option = await masterQuoter.findById(optionId);

        if (!option) {
            return res.status(404).json({ message: 'Master Quoter no encontrada' });
        }

        const servicesDetails = [];
        for (const service of option.services) {
            if (service.service_type === 'entrance') {
                const entrance = await Entrance.findById(service.service_id);
                if (entrance) {
                    servicesDetails.push({ type: 'entrance', data: entrance });
                }
            } else if (service.service_type === 'expeditions') {
                const expedition = await Expedition.findById(service.service_id);
                if (expedition) {
                    servicesDetails.push({ type: 'expeditions', data: expedition });
                }
            } else if (service.service_type === 'experience') {
                const experience = await Experience.findById(service.service_id);
                if (experience) {
                    servicesDetails.push({ type: 'experience', data: experience });
                }
            } else if (service.service_type === 'guides') {
                const guide = await Guide.findById(service.service_id);
                if (guide) {
                    servicesDetails.push({ type: 'guides', data: guide });
                }
            } else if (service.service_type === 'transport') {
                const transport = await Transport.findById(service.service_id);
                if (transport) {
                    servicesDetails.push({ type: 'transport', data: transport });
                }
            }else if (service.service_type === 'restaurant') {
                const restaurant = await Restaurant.findById(service.service_id);
                if (restaurant) {
                    servicesDetails.push({ type: 'restaurant', data: restaurant });
                }
            } else if (service.service_type === 'operator') {
                const operator = await Operator.findById(service.service_id);
                if (operator) {
                    const operatorService = operator.servicios.id(service.operator_service_id);
                    servicesDetails.push({
                        type: 'operator',
                        operator: operator.operador,
                        city: operator.ciudad,
                        service: operatorService
                    });
                }
            } else if (service.service_type === 'hotel') {
                const hotel = await Hotel.findById(service.service_id);
                if (hotel) {
                    const hotelService = hotel.services.id(service.hotels_service_id);
                    servicesDetails.push({
                        type: 'hotel',
                        hotel: hotel.name,
                        city: hotel.location,
                        service: hotelService
                    });
                }
            } else if (service.service_type === 'train') {
                const train = await Train.findById(service.service_id);
                if (train) {
                    const trainService = train.services.id(service.train_service_id);
                    servicesDetails.push({
                        type: 'train',
                        train: train.company,
                        service: trainService
                    });
                }
            }
        }

        res.json({
            name: option.name,
            services: servicesDetails
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener la Master Quoter' });
    }
});

// POST: Crear una nueva Master Quoter
router.post('/', async (req, res) => {
    try {
        const { name, services } = req.body;

        // Validación simple
        if (!name || !services || !Array.isArray(services)) {
            return res.status(400).json({ message: 'Faltan campos obligatorios o el formato es incorrecto' });
        }

        const newMasterQuoter = new masterQuoter({
            name,
            services
        });

        await newMasterQuoter.save();

        res.status(201).json({
            message: 'Master Quoter creada exitosamente',
            data: newMasterQuoter
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear la Master Quoter' });
    }
});

// Ruta para eliminar una Master Quoter
router.delete('/:id', async (req, res) => {
    try {
        const deletedOption = await masterQuoter.findByIdAndDelete(req.params.id);
        if (!deletedOption) {
            return res.status(404).json({ message: 'Master Quoter no encontrada' });
        }
        res.status(200).json({ message: 'Master Quoter eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar Master Quoter', error });
    }
});

// Ruta para obtener todas las Master Quoter con solo las referencias a los servicios (_id)
router.get('/', async (req, res) => {
    try {
        const options = await masterQuoter.find().select('_id name services');
        res.status(200).json(options);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los Master Quoter', error });
    }
});

// Ruta para actualizar parcialmente una  Master Quoter
router.patch('/:id', async (req, res) => {
    try {
        const updatedOption = await masterQuoter.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },  // Solo los campos que se envíen en el body serán actualizados
            { new: true, runValidators: true }  // new: true devuelve el documento actualizado
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