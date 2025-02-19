const express = require('express');
const sequelize = require('./config/database');
const HealthCheck = require('./models/healthCheck');

const app = express();
const port = 8080;

if (process.env.NODE_ENV !== 'test') {
    sequelize.sync({ force: false }).then(() => {
        console.log('Database synchronized!');
    }).catch((error) => {
        console.error('Error synchronizing database:', error);
    });
}

// Middleware to handle JSON parsing errors
app.use((req, res, next) => {
    express.json()(req, res, (err) => {
        if (err) {
            return res.status(400).send(); 
        }
        next();
    });
});



app.head('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(405).send();
});

app.get('/healthz', async (req, res) => {
    try {
        if (Object.keys(req.body).length > 0 || Object.keys(req.query).length > 0 || req.get("Content-Length")>0 || req.get("authentication") || req.get("authorization")) {
            return res.status(400).send(); 
        } 
        await HealthCheck.create({});
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send();
    } catch (error) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(503).send();
    }
});

app.get('*', (req, res) => {
    res.status(404).send();
});

app.all('/healthz', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(405).send();
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app;