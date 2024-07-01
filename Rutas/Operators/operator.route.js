const express = require('express');
const router = express.Router();
const Operator = require('../../schemas/operators.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const operator = new Operator(req.body);
        await operator.save();
        res.status(201).send(operator);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const operators = await Operator.find();
        res.status(200).send(operators);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const operator = await Operator.findById(req.params.id);
        if (!operator) {
            return res.status(404).send();
        }
        res.status(200).send(operator);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const operator = await Operator.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!operator) {
            return res.status(404).send();
        }
        res.status(200).send(operator);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const operator = await Operator.findByIdAndDelete(req.params.id);
        if (!operator) {
            return res.status(404).send();
        }
        res.status(200).send(operator);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;