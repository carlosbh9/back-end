const exs = require("express");

//const HotelsRoutes = require ("./Hotel/hotel.route")
//const TrainRoutes = require ("./Train/train.route")
const restaurantRoutes = require ("./Restaurant/restaurant.route")

function routes(app){
    const route = exs.Router();
    app.use("/api",route);
    app.use('/api/restaurants', restaurantRoutes);
    //route.use("/train",TrainRoute);
}

module.exports = routes;