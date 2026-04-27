const express    = require("express");
const router     = express.Router();
const db         = require("../models/db");
const autenticar = require("../middleware/auth");

// POST /api/apostas/pagar
router.post("/pagar", autenticar, async (req, res) => { // ✅ autenticar adicionado aqui
  try {
     console.log("BODY RECEBIDO:", req.body); // ✅ adicione esta linha
  console.log("USUARIO TOKEN:", req.usuario); // ✅ e esta
    const { id_compra, chavepix_dono, nome_titular } = req.body;
    const id_usuario = req.usuario.id_usuario; // ✅ vem do token

    if (!id_compra || !chavepix_dono || !nome_titular) {
      return res.status(400).json({ erro: "Dados incompletos" });
    }

    await db.query(
      `INSERT INTO cartoes (id_compra, chavepix_dono, nome_titular, id_usuario)
       VALUES (?, ?, ?, ?)`,
      [id_compra, chavepix_dono, nome_titular, id_usuario]
    );

    res.json({ sucesso: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao salvar pagamento" });
  }
});

// GET /api/apostas/qrcode-pix
router.get("/qrcode-pix", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT chave_pix, qr_code FROM pix LIMIT 1"
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "PIX não encontrado" });
    }

    return res.json({
      chave_pix: rows[0].chave_pix,
      qr_code:   rows[0].qr_code,
    });
  } catch (error) {
    console.error("Erro ao buscar PIX:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
});

module.exports = router;