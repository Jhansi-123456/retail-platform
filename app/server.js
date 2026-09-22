const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || "5.0.0";
const ENVIRONMENT = process.env.ENVIRONMENT || "local";

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "customeruser";
const DB_PASSWORD = process.env.DB_PASSWORD || "CustomerPass123!";
const DB_NAME = process.env.DB_NAME || "customerdb";

const dbConfig = {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
};

async function getDatabaseConnection() {
    return await mysql.createConnection(dbConfig);
}

app.get("/", (req, res) => {
    res.json({
        application: "Retail Platform",
        version: VERSION,
        environment: ENVIRONMENT,
        paymentStatus: "FIXED"
    });
});

app.get("/health", async (req, res) => {
    try {
        const connection = await getDatabaseConnection();
        await connection.query("SELECT 1");
        await connection.end();

        res.status(200).json({
            status: "HEALTHY",
            version: VERSION,
            environment: ENVIRONMENT,
            database: "CONNECTED"
        });
    } catch (error) {
        res.status(500).json({
            status: "UNHEALTHY",
            version: VERSION,
            environment: ENVIRONMENT,
            database: "DISCONNECTED"
        });
    }
});

app.get("/env", (req, res) => {
    res.json({
        environment: ENVIRONMENT,
        version: VERSION
    });
});

app.get("/db-test", async (req, res) => {
    try {
        const connection = await getDatabaseConnection();

        const [rows] = await connection.query(
            "SELECT COUNT(*) AS customerCount FROM customers"
        );

        await connection.end();

        res.status(200).json({
            database: "CONNECTED",
            customerCount: rows[0].customerCount,
            environment: ENVIRONMENT,
            version: VERSION
        });
    } catch (error) {
        res.status(500).json({
            database: "CONNECTION_FAILED",
            error: error.message
        });
    }
});

app.get("/customers/search", async (req, res) => {
    const name = req.query.name || "";

    try {
        const connection = await getDatabaseConnection();

        const [rows] = await connection.execute(
            "SELECT id, name, email FROM customers WHERE name LIKE ?",
            [`%${name}%`]
        );

        await connection.end();

        res.status(200).json({
            environment: ENVIRONMENT,
            version: VERSION,
            search: name,
            customers: rows
        });
    } catch (error) {
        res.status(500).json({
            error: "Customer search failed",
            message: error.message
        });
    }
});

app.get("/payment", (req, res) => {
    res.json({
        paymentStatus: "FIXED",
        message: "Payment processing fixed successfully",
        version: VERSION
    });
});

app.get("/products", (req, res) => {
    res.json({
        products: [
            "Laptop",
            "Mobile",
            "Headphones"
        ],
        version: VERSION
    });
});

app.get("/orders", (req, res) => {
    res.json({
        orders: [
            "ORD-1001",
            "ORD-1002"
        ],
        version: VERSION
    });
});

if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(
            `Retail Platform ${VERSION} running on port ${PORT} in ${ENVIRONMENT}`
        );
    });
}

module.exports = app;