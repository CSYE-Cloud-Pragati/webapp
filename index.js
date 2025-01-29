const express = require('express');
const sequelize = require('./config/database');
const HealthCheck = require('./models/healthCheck');

const app = express();
const port = 8080;

sequelize.sync({ force: false }).then(() => {
    console.log('Database synchronized!');
}).catch((error) => {
    console.error('Error synchronizing database:', error);
});

app.use(express.json());  

app.head('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(405).send();
});

app.get('/healthz', async (req, res) => {
    try {
        
        if (Object.keys(req.body).length > 0 || Object.keys(req.query).length > 0 || req.get("Content-Length")>0) {
            return res.status(400).send(); 
        }
      
        await HealthCheck.create({});

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send();
    } catch (error) {
        console.error('Error during health check:', error);

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(503).send();
    }
});

app.all('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(405).send();
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
