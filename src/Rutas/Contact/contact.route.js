const express = require('express');
const router = express.Router();
const Contact = require('../../models/contact.schema'); 
const User = require('../../models/user.schema')
const BookingFile = require('../../models/booking_file.schema');
const  { authenticate, authorize }= require('../../middlewares/auth');
const serviceOrderOrchestrator = require('../../Services/service-orders/service-order.orchestrator');

function enforceSingleSold(cotizations = [], soldQuoterId) {
  const normalizedCotizations = Array.isArray(cotizations)
    ? cotizations.map((cotization) => ({ ...cotization }))
    : [];

  let normalizedSoldId = soldQuoterId ? String(soldQuoterId) : '';

  if (normalizedSoldId) {
    let hasMatch = false;
    normalizedCotizations.forEach((cotization) => {
      const currentId = cotization?.quoter_id ? String(cotization.quoter_id) : '';
      const isSelected = currentId && currentId === normalizedSoldId;
      if (isSelected) {
        hasMatch = true;
        cotization.status = 'SOLD';
      } else if (cotization.status === 'SOLD') {
        cotization.status = 'HOLD';
      }
    });
    if (!hasMatch) {
      normalizedSoldId = '';
    }
  }

  if (!normalizedSoldId) {
    const soldIndexes = [];
    normalizedCotizations.forEach((cotization, index) => {
      if (cotization?.status === 'SOLD') {
        soldIndexes.push(index);
      }
    });

    if (soldIndexes.length > 0) {
      const winnerIndex = soldIndexes[0];
      const winnerId = normalizedCotizations[winnerIndex]?.quoter_id
        ? String(normalizedCotizations[winnerIndex].quoter_id)
        : '';

      soldIndexes.slice(1).forEach((index) => {
        normalizedCotizations[index].status = 'HOLD';
      });

      normalizedSoldId = winnerId || '';
    }
  }

  if (normalizedSoldId) {
    normalizedCotizations.forEach((cotization) => {
      const currentId = cotization?.quoter_id ? String(cotization.quoter_id) : '';
      if (cotization.status === 'SOLD' && currentId !== normalizedSoldId) {
        cotization.status = 'HOLD';
      }
    });
  }

  return {
    cotizations: normalizedCotizations,
    soldQuoterId: normalizedSoldId || null
  };
}

// Crear un nuevo contacto
// router.post('/',async (req, res) => {
//     const { name } = req.body;
//     const userId = req.user.id;
//     try {
//         let contact = await Contact.findOne({ name: name });
//         if (!contact) {
//             contact = new Contact(req.body);
//             await contact.save();
//             const user = await User.findById(userId);
//             if (!user) {
//                 return res.status(404).json({ error: 'Usuario no encontrado' });
//             }
//             user.contacts.push(contact._id); // Agregar el contacto al array de contactos del usuario
//             await user.save();
//         }else{
//             return res.status(400).json({ message: 'El contacto ya existe' });
//         }
//         res.status(201).send(contact);
//     } catch (error) {
//         res.status(400).send(error);
//     }
// });
// Crear un nuevo contacto version 2
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, email } = req.body;   // añade los campos que necesites
    const ownerId = req.user.id;               // ← propietario

    /* 1. Verificar que el contacto no exista ya (por name)   */
    const duplicate = await Contact.findOne({ name });
    if (duplicate) {
      return res.status(400).json({ message: 'El contacto ya existe' });
    }

    /* 2. Verificar que el usuario destino exista            */
    const owner = await User.findById(ownerId).select('_id');
    if (!owner) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    /* 3. Crear y guardar el contacto                        */
    const contact = await Contact.create({
      name,
      phone,
      email,
      owner: ownerId               // ← clave: guardamos el propietario
    });

    res.status(201).json(contact);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Error al crear contacto', err: err.message });
  }
});

// Ruta para obtener todas las cotizaciones de todos los contactos
router.get('/all-cotizations', async (req, res) => {
    try {
        const cotizations = await Contact.aggregate([
            {
                $unwind: {
                    path: '$cotizations',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    contactId: '$_id',
                    contactName: '$name',
                    cotization: '$cotizations',
                
                    _id: 0
                }
            }
        ]);

        res.status(200).json(cotizations);
    } catch (error) {
        console.error('Error al extraer cotizaciones:', error);
        res.status(500).send({ error: 'Error al obtener las cotizaciones' });
    }
});
router.get('/all-contacts', async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const allowedRoles = ['admin', 'ventas'];

    if (allowedRoles.includes(userRole)) {
      Contact.find()
        .then(contacts => res.json(contacts))
        .catch(err => res.status(500).json({ message: 'Error al obtener contactos', error: err }));
    } else {
       // Si el usuario no es admin, devuelve solo los contactos asignados a ese usuario
       const user = await User.findById(userId).populate({path:'contacts',select:'name _id'}); // Populate para cargar los contactos del usuario
       if (!user) {
         return res.status(404).json({ message: 'Usuario no encontrado' });
       }
       
       return res.json(user.contacts);
    }
});
// router.get('/', authenticate, async (req, res) => {
//     try {
//         const userId = req.user.id;
//         const userRole = req.user.role;
//         const allowedRoles = ['admin', 'ventas'];
//         // Obtener parámetros de paginación
//         const page = parseInt(req.query.page) || 1;
//         const pageSize = parseInt(req.query.pageSize) || 10;
//         const filter = req.query.filter || '';
//         const skip = (page - 1) * pageSize;
//         const getAll = req.query.all === 'true'

//         const filterCriteria = filter ? { name: { $regex: new RegExp(filter, 'i') } } : {};

//         let contacts;
//         let totalContacts;

//         if (allowedRoles.includes(userRole)) {
//             if(getAll){
//                 contacts = await Contact.find(filterCriteria).sort({ createdAt: -1 }).limit(pageSize).select('name _id');
//                 totalContacts = contacts.length;
//             }else {
//                 // Obtener todos los contactos con paginación
//                 totalContacts = await Contact.countDocuments();
//                 contacts = await Contact.find(filterCriteria).sort({ createdAt: -1 }).skip(skip).limit(pageSize);
//             }
            
//         } else {
//             // Obtener solo los contactos asignados al usuario
//             const user = await User.findById(userId).populate({
//                 path: 'contacts',
//                 match: filterCriteria ,
//                 options: getAll ? {} : { skip, limit: pageSize },
//             });
//             if (!user) {
//                 return res.status(404).json({ message: 'Usuario no encontrado' });
//             }

//             totalContacts = user.contacts.length;
//             contacts = user.contacts;
//         }

//         res.json({ contacts, totalContacts, page, pageSize });
//     } catch (err) {
//         console.error('Error al obtener contactos:', err);
//         res.status(500).json({ message: 'Error interno al obtener contactos', error: err });
//     }
// });

// routes/contact.route.js
router.get('/', authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const userRole = req.user.role;
    const allowedRoles = ['admin', 'ventas'];

    /* ---------- paginación ---------- */
    const page     = Number(req.query.page)     || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const skip     = (page - 1) * pageSize;

    const getAll   = req.query.all === 'true';
    const filter   = req.query.filter || '';
    const nameRegex = new RegExp(filter, 'i');

    /* ---------- filtro base ---------- */
    const filterCriteria = { name: { $regex: nameRegex } };

    /* --- Si NO es admin/ventas, añade owner al filtro --- */
    if (!allowedRoles.includes(userRole)) {
      filterCriteria.owner = userId;          // ← clave
    }

    /* --- Query principal --- */
    let contacts, totalContacts;

    if (getAll) {
      // Traer solo name/_id o lo que quieras mostrar en el autocompletado
      contacts = await Contact.find(filterCriteria)
                              .sort({ createdAt: -1 })
                              .select('name _id')
                              .limit(pageSize);           // quítalo si "all" debe ser sin límite
      totalContacts = contacts.length;                    // sólo los devueltos
    } else {
      totalContacts = await Contact.countDocuments(filterCriteria);
      contacts = await Contact.find(filterCriteria)
                              .sort({ createdAt: -1 })
                              .skip(skip)
                              .limit(pageSize);
    }

    res.json({ contacts, totalContacts, page, pageSize });
  } catch (err) {
    console.error('Error al obtener contactos:', err);
    res.status(500).json({ message: 'Error interno al obtener contactos', error: err });
  }
});

//Obtener un contacto por ID
router.get('/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            return res.status(404).send();
        }
        res.status(200).send(contact);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un contacto por ID
router.patch('/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id).lean();
        if (!contact) return res.status(404).send();
        const previousSoldQuoterId = contact.soldQuoterId ? String(contact.soldQuoterId) : null;

        const incomingData = { ...req.body };
        const hasCotizationsUpdate = Array.isArray(incomingData.cotizations);
        const hasSoldQuoterUpdate = Object.prototype.hasOwnProperty.call(incomingData, 'soldQuoterId');

        if (hasCotizationsUpdate || hasSoldQuoterUpdate) {
          const cotizations = hasCotizationsUpdate ? incomingData.cotizations : contact.cotizations;
          const soldQuoterId = hasSoldQuoterUpdate ? incomingData.soldQuoterId : contact.soldQuoterId;
          const normalized = enforceSingleSold(cotizations, soldQuoterId);
          incomingData.cotizations = normalized.cotizations;
          incomingData.soldQuoterId = normalized.soldQuoterId;
        }

        const updatedContact = await Contact.findByIdAndUpdate(
          req.params.id,
          incomingData,
          { new: true, runValidators: true }
        );

        const currentSoldQuoterId = updatedContact?.soldQuoterId ? String(updatedContact.soldQuoterId) : null;
        const changedBy = req.user?.id || null;

        // If sold quote changed, create/ensure operational orders from CONTACT_SOLD.
        if (currentSoldQuoterId && currentSoldQuoterId !== previousSoldQuoterId) {
          const bookingFile = await BookingFile.findOne({ quoter_id: currentSoldQuoterId }).select('_id');
          if (!bookingFile) {
            return res.status(400).json({ message: 'Booking file not found for current sold quoter' });
          }
          await serviceOrderOrchestrator.createOrdersForContactSold({
              contactId: req.params.id,
              soldQuoterId: currentSoldQuoterId,
              fileId: String(bookingFile._id),
              changedBy
            });
        }

        // If sale was reverted, cancel previous event orders (do not delete).
        if (!currentSoldQuoterId && previousSoldQuoterId) {
          const previousEventId = serviceOrderOrchestrator.buildBusinessEventId({
            contactId: req.params.id,
            soldQuoterId: previousSoldQuoterId
          });
          await serviceOrderOrchestrator.cancelOrdersForBusinessEvent({
            businessEventId: previousEventId,
            reason: 'Contact sale reverted',
            changedBy
          });
        }

        res.status(200).send(updatedContact);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un contacto por ID
// router.delete('/:id',  async (req, res) => {
//     try {
//         const contact = await Contact.findByIdAndDelete(req.params.id);
//         if (!contact) {
//             return res.status(404).send();
//         }
//         res.status(200).send(contact);
//     } catch (error) {
//         res.status(500).send(error);
//     }
// });

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1) eliminar el contacto
    const contact = await Contact.findByIdAndDelete(id);
    if (!contact) return res.status(404).json({ message: 'Contacto no encontrado' });

    // 2) quitar la referencia en TODOS los usuarios que lo tuvieran
    await User.updateMany(
      { contacts: id },
      { $pull: { contacts: id } }
    );

    res.status(200).json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar contacto', err });
  }
});

module.exports = router;
