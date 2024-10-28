const express = require('express');
const router = express.Router();
const LimaGourmet = require('../../../src/models/gourmet.schema');

// Crear un nuevo LimaGourmet
router.post('/', async (req, res) => {
    try {
        const gourmet = new LimaGourmet(req.body);
        await gourmet.save();
        res.status(201).send(gourmet);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los Lima Gourmets
router.get('/', async (req, res) => {
    try {
        const gourmets = await LimaGourmet.find();
        res.status(200).send(gourmets);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un LimaGourmet por ID
router.get('/:id', async (req, res) => {
    try {
        const gourmet = await LimaGourmet.findById(req.params.id);
        if (!gourmet) {
            return res.status(404).send();
        }
        res.status(200).send(gourmet);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un LimaGourmet por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const gourmet = await LimaGourmet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!gourmet) {
            return res.status(404).send();
        }
        res.status(200).send(gourmet);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un LimaGourmet por ID
router.delete('/:id', async (req, res) => {
    try {
        const gourmet = await LimaGourmet.findByIdAndDelete(req.params.id);
        if (!gourmet) {
            return res.status(404).send();
        }
        res.status(200).send(gourmet);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;