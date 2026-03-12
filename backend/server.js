const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/projects',  require('./routes/projects'));
app.use('/api/tasks',     require('./routes/tasks'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/sales',     require('./routes/sales'));
app.use('/api/accounts',  require('./routes/accounts'));
app.use('/api/templates', require('./routes/estimate-templates'));

// Root route
app.get('/', (req, res) => {
    res.send('CRMM API is running');
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
}

module.exports = app;
