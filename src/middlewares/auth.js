 const jwt = require('jsonwebtoken');
//import jwt from 'jsonwebtoken';
//const JWT_SECRET = 'secretKey'; // Usa una variable de entorno
require('dotenv').config()


const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Token no proporcionado' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const authorize = (roles = []) => {
    // return (req, res, next) => {
    //   if (!roles.includes(req.user.role)) {
    //     return res.status(403).json({ error: 'Permiso denegado'});
    //   }
    //   next();
    // };
    return (req, res, next) => {
      try {
          const token = req.headers.authorization?.split(' ')[1];
          if (!token) return res.status(401).json({ error: 'Acceso denegado, token requerido' });

          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;

          if (!roles.includes(req.user.role)) {
              return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
          }

          next();
      } catch (error) {
          res.status(401).json({ error: 'Token inválido o expirado' });
      }
  };
  };
  
 

 module.exports = {authenticate,authorize};
//export { authenticate, authorize };