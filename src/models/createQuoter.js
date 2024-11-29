const Quoter = require('../models/quoter.schema');
const Contact = require('../models/contact.schema');

exports.createQuoter = async (req, res) => {
  const { guest, FileCode, travelDate, totalNights,accomodations, number_paxs, travel_agent, exchange_rate, services, hotels, flights, operators, cruises, total_prices } = req.body;


  try {
    // Verificar si el contacto ya existe
    let contact = await Contact.findOne({ name: guest });  // Usamos el email como identificador único

    if (!contact) {
      // Si el contacto no existe, lo creamos
      contact = new Contact({
        name: guest,

      });

      // Guardamos el contacto
      await contact.save();
    }

    // Crear la primera versión de la cotización
    const firstVersion =new Quoter({
    contact_id: contact._id,
    guest,
    FileCode,
    travelDate,
    accomodations, 
    number_paxs,
    totalNights, 
    travel_agent, 
    exchange_rate, 
    services, 
    hotels, 
    flights, 
    operators, 
    cruises,
    total_prices,  // Usar los precios totales de la cotización inicial
    });
    await firstVersion.save();



    // Guardamos la cotización
 //   await newQuoter.save();

    // Asociamos la cotización al contacto
    contact.cotizations.push(firstVersion._id);
    await contact.save();

    // Respondemos con la cotización creada
    res.status(201).json(contact);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la cotización' });
  }



};

//module.exports = {createQuoter};
