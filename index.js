const exs = require("express");
const routes = require('./src/Rutas');
const connectDB = require('./db/db.js');
const  morgan = require('morgan')
const { mostrarError, boomManejaError, manejarError } = require('./src/middlewares/handleErrors.js');

const cors = require('cors')
//const { use } = require("./Rutas/Lotes/Lotes.route");
const {authenticate} = require('./src/middlewares/auth.js')

const apk = exs();
const puerto = 3000;

const corsOptions = {
  origin: [
    'http://localhost:4200',      // Sistema 1 frontend (dev)
    'http://localhost:65425',      // Sistema 2 frontend (dev)
    'http://44.201.126.204:4201'   // Sistema 2 frontend (prod)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

apk.use(exs.json());
apk.use(cors(corsOptions));
apk.use(morgan('dev'));
connectDB();
routes(apk);

// apk.use(mostrarError); // Registro del error
// apk.use(boomManejaError); // Manejo de errores Boom
apk.use(manejarError); // Manejo de errores genéricos
apk.use(authenticate);
 
apk.listen(puerto, () =>{
  console.log("puerto " + puerto + " activo")
});


