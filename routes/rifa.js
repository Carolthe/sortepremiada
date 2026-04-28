const express    = require("express");
const router     = express.Router();
const db         = require("../models/db");
const autenticar = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rifa/numeros  — retorna todos com status
// ─────────────────────────────────────────────────────────────────────────────
router.get("/numeros", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_numero, numero, status FROM numeros_rifa ORDER BY numero ASC"
    );
    res.json(rows); // [{id_numero, numero, status}]
  } catch (error) {
    console.error("Erro ao buscar números:", error);
    res.status(500).json({ erro: "Erro ao buscar números" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rifa/compras  — cria compra + reserva números
// ─────────────────────────────────────────────────────────────────────────────
router.post("/compras", autenticar, async (req, res) => {
  try {
    const { total_numeros, valor_total, numeros } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!total_numeros || !valor_total || !numeros?.length) {
      return res.status(400).json({ erro: "Dados incompletos" });
    }

    // 1. Verifica números já ocupados
    const placeholders = numeros.map(() => "?").join(",");
    const [jaOcupados] = await db.query(
      `SELECT numero FROM numeros_rifa
        WHERE numero IN (${placeholders})
          AND status != 'disponivel'`,
      numeros
    );

    if (jaOcupados.length > 0) {
      const ocupados = jaOcupados.map((r) => r.numero).join(", ");
      return res.status(409).json({
        erro: `Números já reservados ou vendidos: ${ocupados}`,
      });
    }

    // 2. Cria a compra
    const [result] = await db.query(
      `INSERT INTO compras (id_usuario, total_numeros, valor_total, status, data_compra)
       VALUES (?, ?, ?, 'reservado', NOW())`,
      [id_usuario, total_numeros, valor_total]
    );
    const id_compra = result.insertId;

    // 3. Insere compra_numeros e reserva
    for (const numero of numeros) {
      const [num] = await db.query(
        "SELECT id_numero FROM numeros_rifa WHERE numero = ?",
        [numero]
      );
      if (num.length > 0) {
        const id_numero = num[0].id_numero;

        await db.query(
          "INSERT INTO compra_numeros (id_compra, id_numero) VALUES (?, ?)",
          [id_compra, id_numero]
        );

        await db.query(
          "UPDATE numeros_rifa SET status = 'reservado' WHERE id_numero = ?",
          [id_numero]
        );
      }
    }

    res.json({ id_compra });

  } catch (error) {
    console.error("Erro ao criar compra:", error);
    res.status(500).json({ erro: "Erro ao criar compra" });
  }
});

module.exports = router;