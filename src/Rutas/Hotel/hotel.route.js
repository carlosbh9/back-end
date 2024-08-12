const express = require('express');
const router = express.Router();
const Hotel = require('../../../src/models/hotels.schema');

// Crear un nuevo hotel
router.post('/', async (req, res) => {
    try {
        const hotel = new Hotel(req.body);
        await hotel.save();
        res.status(201).send(hotel);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los hoteles
router.get('/', async (req, res) => {
    try {
        const hotels = await Hotel.find();
        res.status(200).send(hotels);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un hotel por ID
router.get('/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        if (!hotel) {
            return res.status(404).send();
        }
        res.status(200).send(hotel);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un hotel por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!hotel) {
            return res.status(404).send();
        }
        res.status(200).send(hotel);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un hotel por ID
router.delete('/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findByIdAndDelete(req.params.id);
        if (!hotel) {
            return res.status(404).send();
        }
        res.status(200).send(hotel);
    } catch (error) {
        res.status(500).send(error);
    }
});

//crear un nuevo servicio
router.post('/:hotelId/services', async (req, res) => {
    const {hotelId} = req.params;
    const newService = req.body;
    try{
        const hotel = await Hotel.findById(hotelId);
        if(!hotel){
            return res.status(404).send({message: 'Hotel not found'});
        }
        hotel.services.push(newService);
        await hotel.save();
        res.status(201).send(newService);
    }catch(error){
        res.status(400).send(error);
    }
});


//obtener todos los servicios de un hotel
router.get('/:hotelId/services', async (req, res) => {
    const {hotelId} = req.params;
    try{
        const hotel = await Hotel.findById(hotelId).select('services');
        if(!hotel){
            return res.status(404).send({message: 'Hotel not found'});
        }
        res.status(200).send(hotel.services);
    }catch(error){
        res.status(400).send(error);
    }
});

//actualizar un servicio de un hotel
router.patch('/:hotelId/services/:serviceId', async (req, res) => {
    const {hotelId, serviceId} = req.params;
    const serviceUpdates = req.body;

    try{
        const hotel = await Hotel.findById(hotelId);
        if(!hotel){
            return res.status(404).send({message: 'Hotel not found'});
        }
        const service = hotel.services.id(serviceId);
        if(!service){
            return res.status(404).send({message: 'Service not found'});
        }
        service.set(serviceUpdates);
        await hotel.save();
        res.status(200).send(service);
    }catch(error){
        res.status(400).send(error);
    }
});

//eliminar un servicio de un hotel
router.delete('/:hotelId/services/:serviceId', async (req, res) => {
    const {hotelId, serviceId} = req.params;
    try{
        const hotel = await Hotel.findByIdAndUpdate(
            hotelId, 
            {$pull: {services: {_id: serviceId}}},
            {new: true}
        );
        if(!hotel){
            return res.status(404).send({message: 'Hotel or service not found'});
        }
      
        res.status(200).send({message: 'Service deleted'});
    }catch(error){
        res.status(400).send({message: 'Error deleting service',error});
    }
});

module.exports = router;