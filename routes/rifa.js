const express = require("express");
const router = express.Router();
const db = require("../models/db");
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
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { total_numeros, valor_total, numeros } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!total_numeros || !valor_total || !numeros?.length) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ erro: "Dados incompletos" });
    }

    // 1. Verifica se algum número já está reservado ou vendido
    const placeholders = numeros.map(() => "?").join(",");
    const [jaOcupados] = await conn.query(
      `SELECT numero FROM numeros_rifa
        WHERE numero IN (${placeholders})
          AND status != 'disponivel'`,
      numeros
    );

    if (jaOcupados.length > 0) {
      await conn.rollback();
      conn.release();
      const ocupados = jaOcupados.map((r) => r.numero).join(", ");
      return res.status(409).json({
        erro: `Os seguintes números já foram reservados ou vendidos: ${ocupados}`,
      });
    }

    // 2. Cria a compra
    const [result] = await conn.query(
      `INSERT INTO compras (id_usuario, total_numeros, valor_total, data_compra)
       VALUES (?, ?, ?, NOW())`,
      [id_usuario, total_numeros, valor_total]
    );
    const id_compra = result.insertId;

    // 3. Insere em compra_numeros e reserva os números
    for (const numero of numeros) {
      const [num] = await conn.query(
        "SELECT id_numero FROM numeros_rifa WHERE numero = ?",
        [numero]
      );
      if (num.length > 0) {
        const id_numero = num[0].id_numero;

        await conn.query(
          "INSERT INTO compra_numeros (id_compra, id_numero) VALUES (?, ?)",
          [id_compra, id_numero]
        );

        await conn.query(
          "UPDATE numeros_rifa SET status = 'reservado' WHERE id_numero = ?",
          [id_numero]
        );
      }
    }

    await conn.commit();
    conn.release();

    res.json({ id_compra });
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error("Erro ao criar compra:", error);
    res.status(500).json({ erro: "Erro ao criar compra" });
  }
});

module.exports = router;