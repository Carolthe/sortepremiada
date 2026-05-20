require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

console.log("MYSQLHOST =", process.env.MYSQLHOST);
console.log("MYSQLPORT =", process.env.MYSQLPORT);
console.log("MYSQLUSER =", process.env.MYSQLUSER);


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});