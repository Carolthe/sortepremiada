const jwt = require("jsonwebtoken");
const JWT_SECRET = require("../config/jwt");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log("AUTH HEADER:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, JWT_SECRET);

    req.usuario = decoded;

    next();

  } catch (err) {

    console.log("ERRO JWT:", err.message);

    return res.status(401).json({
      error: "Token inválido"
    });
  }
};