const express = require('express');
const boomErrors = require('@hapi/boom')
const router = express.Router();
const Restaurant = require('../../../src/models/Restaurant.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const restauerant = new Restaurant(req.body);
        await restaurant.save();
        res.status(201).send(restaurant);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const sortField = req.query.sort || 'name';  // Por defecto ordenar por nombre
        const sortOrder = req.query.order === 'desc' ? -1 : 1;
        const restaurants = await Restaurant.find().sort({ [sortField]: sortOrder }).exec();
        res.status(200).send(restaurants);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).send(boomErrors.notFound('Error, ID novalida/encontrada'));
        }
        res.status(200).send(restaurant);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!restaurant) {
            return res.status(404).send();
        }
        res.status(200).send(restaurant);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
        if (!restaurant) {
            return res.status(404).send();
        }
        res.status(200).send(restaurant);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;