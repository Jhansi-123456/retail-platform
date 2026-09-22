const config = {
    environment: process.env.ENVIRONMENT || "DEVELOPMENT",
    message: process.env.ENVIRONMENT
        ? `${process.env.ENVIRONMENT} configuration`
        : "Development configuration"
};

module.exports = config;