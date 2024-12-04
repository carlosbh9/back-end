const express = require('express');
const router = express.Router();
const Extras = require('../../models/extras.schema'); // Asegúrate de importar el modelo correcto

// Crear un nuevo extra
router.post('/', async (req, res) => {
    try {
        // Asegúrate de que el cuerpo de la solicitud incluya priceType como booleano
        const { name, price, year, priceperson ,notes} = req.body;
        const extra = new Extras({ name, price, year, priceperson,notes });
        await extra.save();
        res.status(201).send(extra);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los extras
router.get('/', async (req, res) => {
    try {
        const extras = await Extras.find();
        res.status(200).send(extras);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un extra por ID
router.get('/:id', async (req, res) => {
    try {
        const extra = await Extras.findById(req.params.id);
        if (!extra) {
            return res.status(404).send();
        }
        res.status(200).send(extra);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un extra por ID
router.patch('/:id', async (req, res) => {
    try {
        const extra = await Extras.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!extra) {
            return res.status(404).send();
        }
        res.status(200).send(extra);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un extra por ID
router.delete('/:id', async (req, res) => {
    try {
        const extra = await Extras.findByIdAndDelete(req.params.id);
        if (!extra) {
            return res.status(404).send();
        }
        res.status(200).send(extra);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;