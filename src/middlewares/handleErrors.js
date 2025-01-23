const Boom = require('@hapi/boom');

const mostrarError = (err, req, res, next) => {
  console.log('Error detectado:');
  console.error(err); // Registro detallado del error
  next(err); // Pasa el error al siguiente middleware
};

// Middleware para manejar errores de Boom
const boomManejaError = (err, req, res, next) => {
  if (Boom.isBoom(err)) {
    return res.status(err.output.statusCode).json({
        statusCode: err.output.statusCode,
        error: err.output.payload.error,
        message: err.data.originalError
    });
}
next(err); 
};

// Middleware para manejar errores genéricos
const manejarError = (err, req, res, next) => {
  console.error(err); // Log del error
    res.status(500).json({
        statusCode: 500,
        message: 'Error interno del servidor'
    });
};
module.exports = {mostrarError,boomManejaError,manejarError};
  