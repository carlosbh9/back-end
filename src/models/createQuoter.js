const Boom = require('@hapi/boom');
const Quoter = require('../models/quoter.schema');
const Contact = require('../models/contact.schema');
const User = require('../models/user.schema');

exports.createQuoter = async (req, res, next) => {
  const {
    name_version,
    guest,
    FileCode,
    travelDate,
    totalNights,
    accomodations,
    number_paxs,
    travel_agent,
    exchange_rate,
    services,
    hotels,
    flights,
    operators,
    cruises,
    total_prices,
    destinations,
    children_ages
  } = req.body;

  const username = req.user?.username;

  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(Boom.unauthorized('Usuario no autenticado'));
    }

    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Busca por nombre; si no existe, crea con owner requerido por el esquema.
    let contact = await Contact.findOne({ name: guest });

    if (!contact) {
      contact = new Contact({
        name: guest,
        td_designed: username,
        owner: userId
      });

      await contact.save();
    }
    if (!contact.owner) {
      contact.owner = userId;
    }

    const quoter = new Quoter({
      contact_id: contact._id,
      name_quoter: name_version,
      guest,
      FileCode,
      travelDate,
      accomodations,
      destinations,
      children_ages,
      number_paxs,
      totalNights,
      travel_agent,
      exchange_rate,
      services,
      hotels,
      flights,
      operators,
      cruises,
      total_prices
    });

    await quoter.save();

    contact.cotizations.push({
      name_version,
      quoter_id: quoter._id,
      createQuoter: quoter.createQuoter
    });
    await contact.save();

    return res.status(201).json(contact);
  } catch (error) {
    if (error?.isBoom) {
      return next(error);
    }

    if (error?.name === 'ValidationError') {
      return next(Boom.badRequest('Error de validacion al crear la cotizacion', { originalError: error.message }));
    }

    console.error('createQuoter error:', error);
    return next(Boom.internal('Error al crear la cotizacion', { originalError: error.message }));
  }
};
