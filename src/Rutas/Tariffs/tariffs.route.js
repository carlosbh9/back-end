const express = require('express');

const router = express.Router();
const Tariff = require('../../models/tarifario.schema');
const { getDiscriminatorType } = require('../../utils/tariffResolver');

router.get('/', async (req, res) => {
  try {
    const { type, year, active } = req.query;
    const filters = {};

    if (type) {
      const discriminatorType = getDiscriminatorType(type);
      filters.type = discriminatorType || type;
    }

    if (year) {
      filters.year = String(year);
    }

    if (active !== undefined) {
      filters.active = active === 'true';
    }

    const tariffs = await Tariff.find(filters).sort({ type: 1, year: 1, createdAt: -1 });
    res.status(200).json(tariffs);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el tarifario centralizado', error });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tariff = await Tariff.findById(req.params.id);
    if (!tariff) {
      return res.status(404).json({ message: 'Tarifa no encontrada' });
    }

    res.status(200).json(tariff);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la tarifa', error });
  }
});

module.exports = router;
