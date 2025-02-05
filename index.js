const exs = require("express");
const routes = require('./src/Rutas');
const connectDB = require('./db/db.js');
const  morgan = require('morgan')
const { mostrarError, boomManejaError, manejarError } = require('./src/middlewares/handleErrors.js');

const cors = require('cors')
//const { use } = require("./Rutas/Lotes/Lotes.route");

//const {mostrarError, manejarError, boomManejaError}= require('./middlewares/error.middleware');
const apk = exs();
const puerto = 3000;
apk.use(exs.json());
apk.use(cors());
apk.use(morgan('combined'));
connectDB();
routes(apk);

// apk.use(mostrarError); // Registro del error
// apk.use(boomManejaError); // Manejo de errores Boom
apk.use(manejarError); // Manejo de errores genéricos

 
apk.listen(puerto, () =>{
  console.log("puerto " + puerto + " activo")
});


