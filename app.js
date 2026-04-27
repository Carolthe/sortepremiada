const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser"); // ✅ para ler cookies
require("dotenv").config();

const app = express();

// Configurar CORS corretamente para enviar cookies
app.use(cors({
  origin: [
    "http://localhost:8081",
    
  ],
  credentials: true
}));

app.use(cookieParser()); // ✅ necessário para ler cookies
app.use(express.json());


// Rotas
app.use("/api/usuarios", require("./routes/usuario"));
app.use("/api/rifa", require("./routes/rifa"))
app.use("/api/apostas", require("./routes/apostas"))

// Healthcheck Monitoramento 
app.get("/health/db", async (req, res) => {
  const db = require("./models/db");
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;