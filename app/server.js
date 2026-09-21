const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || "4.3.0-release";
const PAYMENT_STATUS = process.env.PAYMENT_STATUS || "OK";
const HEALTH_STATUS = process.env.HEALTH_STATUS || "OK";

app.get("/", (req, res) => {
    res.json({
        application: "Retail Platform",
        version: VERSION,
        paymentStatus: PAYMENT_STATUS,
        environment: process.env.ENVIRONMENT || "local"
    });
});

app.get("/health", (req, res) => {
    if (HEALTH_STATUS !== "OK") {
        return res.status(500).json({
            status: "UNHEALTHY",
            version: VERSION
        });
    }

    res.status(200).json({
        status: "HEALTHY",
        version: VERSION
    });
});

app.get("/payment", (req, res) => {
    res.json({
        payment: PAYMENT_STATUS === "FIXED"
            ? "Payment processing fixed successfully"
            : "Payment processing has an issue",
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

app.listen(PORT, () => {
    console.log(`Retail Platform ${VERSION} running on port ${PORT}`);
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