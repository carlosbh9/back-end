const exs = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./src/Rutas');
const connectDB = require('./db/db.js');
const { mostrarError, boomManejaError, manejarError } = require('./src/middlewares/handleErrors.js');

const apk = exs();
const puerto = 3000;

const corsOptions = {
  origin: [
    'http://localhost:4200',
    'http://localhost:65425',
    'http://44.201.126.204:4201',
    'https://kuoda-cotizador-30b67.web.app',
    'https://kuoda-cotizador-30b67.firebaseapp.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

apk.use(exs.json());
apk.use(cors(corsOptions));
apk.use(morgan('dev'));

connectDB();
routes(apk);

apk.use(mostrarError);
apk.use(boomManejaError);
apk.use(manejarError);

apk.listen(puerto, () => {
  console.log(`puerto ${puerto} activo`);
});
