const express = require('express');
const  sequelize  = require('./config/database');
const HealthCheck = require('./models/healthCheck'); 

const app = express();
const port = 8080;

// Sync all models with the database at startup
sequelize.sync({ force: false }).then(() => {  
    console.log('Database synchronized!');
}).catch((error) => {
    console.error('Error synchronizing database:', error);
});

// Health check route
app.get('/healthz', async (req, res) => {
    try {
        if (Object.keys(req.query).length > 0) {
            return res.status(400).send();
        }

        await HealthCheck.create({});

        res.status(200).send();
    } catch (error) {
        console.error('Error during health check:', error);
        res.status(503).send();
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
