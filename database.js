const { MongoClient } = require("mongodb");
const mongoURL = process.env.DB_URL;

let connectDB = new MongoClient(mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).connect();

module.exports = connectDB;
