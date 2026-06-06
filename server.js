require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

// =========================
// MIDDLEWARES
// =========================
app.use(cors());
app.use(express.json());

// =========================
// DATABASE CONNECTION (Neon DB)
// =========================
// আপনার আগের কোড...
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ==========================================
// FIX: Neon DB ঘুমালে যেন সার্ভার ক্র্যাশ না করে
// ==========================================
pool.on('error', (err, client) => {
    console.error('⚠️ Neon DB idle connection error:', err.message);
   
});

pool.connect()
    .then(() => console.log("✅ Neon Database Connected Successfully!"))
    .catch((err) => console.error("❌ DB Connection Error:", err.message));

// =========================
// 1. SEND REQUEST (Connect)
// =========================
app.post("/connections", async (req, res) => {
    try {
        const { sender_id, receiver_id } = req.body;

        if (!sender_id || !receiver_id) {
            return res.status(400).json({ success: false, message: "sender_id and receiver_id required" });
        }

        if (sender_id.toLowerCase() === receiver_id.toLowerCase()) {
            return res.status(400).json({ success: false, message: "It' your ID, Cannot send request to yourself" });
        }

  
        const existing = await pool.query(
            `SELECT * FROM connections WHERE 
            (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)`,
            [sender_id, receiver_id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Request has been sent ago" });
        }

						const friend = await pool.query(`
SELECT * FROM connections WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted'
`, [sender_id])

					if (friend.rows.length > 0) {
					res.status(400).json({
									success: false,
									massage: 'You both are already connected'

});
}

        await pool.query(
            `INSERT INTO connections (sender_id, receiver_id) VALUES ($1, $2)`,
            [sender_id, receiver_id]
        );

        res.json({ success: true, message: "Request Sent" });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================
// 2. FETCH PENDING REQUESTS
// =========================
app.get("/connections/:email", async (req, res) => {
    try {
        const email = req.params.email;

        // শুধু pending রিকোয়েস্টগুলো ফেচ করবে
        const result = await pool.query(
            `SELECT * FROM connections 
            WHERE receiver_id = $1 AND status = 'pending'`,
            [email]
        );

        res.json({ success: true, data: result.rows });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================
// 3. ACCEPT REQUEST
// =========================
app.put("/connections/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const result = await pool.query(
            `UPDATE connections SET status = 'accepted' 
            WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "No connection request" });
        }

        res.json({ success: true, message: "Request Accepted Successfully" });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================
// 4. DENY / DELETE REQUEST
// =========================
app.delete("/connections/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const result = await pool.query(
            `DELETE FROM connections WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Request has not been found" });
        }

        res.json({ success: true, message: "Request Denied and Deleted" });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

//GET ℹ️ℹ️ FRIENDS TO BROWSER

app.get("/friends/:email", async (req, res) => {
        try{
           const email = req.params.email;

           const result = await pool.query(`
                SELECT * FROM connections WHERE (receiver_id = $1 OR sender_id = $1) AND status = 'accepted'` , [email]

                );
           res.json({
                success: true,
                data: result.rows
                });
        } catch(err) {
        console.error(err);
        res.status(500).json({
                success: false,
                message: 'Server error'
                });
        }

});



// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AsirNet Server is running on port ${PORT}`);
});
