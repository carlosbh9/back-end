const exs = require("express");

const HotelsRoute = require ("./Hotels/hotels.route")
const TrainRoute = require ("./Train/train.route")

function routes(app){
    const route = exs.Router();
    app.use("/api",route);
    //route.use("/hotels",HotelsRoute);
    //route.use("/train",TrainRoute);
}

module.exports = routes;