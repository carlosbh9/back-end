const Quoter = require('../models/quoter.schema');
const Contact = require('../models/contact.schema');
const User = require('../models/user.schema')
const  { authenticate, authorize }= require('../middlewares/auth')
exports.createQuoter = async (req, res) => {
  const { name_version, guest, FileCode, travelDate, totalNights,accomodations, number_paxs, travel_agent, exchange_rate, services, hotels, flights, operators, cruises, total_prices } = req.body;


  try {
    // Obtener el usuario logueado desde la solicitud
    const userId = req.user.id;
    // Verificar si el contacto ya existe
    let contact = await Contact.findOne({ name: guest });  // Usamos el email como identificador único

    if (!contact) {
      // Si el contacto no existe, lo creamos
      contact = new Contact({
        name: guest,

      });

      // Guardamos el contacto
      await contact.save();


      // Asociar el contacto al usuario logueado
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      user.contacts.push(contact._id); // Agregar el contacto al array de contactos del usuario
      await user.save();
    }

    // Crear la primera versión de la cotización
    const quoter =new Quoter({
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
    await quoter.save();


    // Asociamos la cotización al contacto
    contact.cotizations.push({name_version: name_version , quoter_id: quoter._id});
    await contact.save();

    // Respondemos con la cotización creada
    res.status(201).json(contact);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la cotización' });
  }



};

//module.exports = {createQuoter};
