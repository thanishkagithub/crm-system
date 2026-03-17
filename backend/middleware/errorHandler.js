// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: err.message
        });
    }

    // Database errors
    if (err.code && err.code.startsWith('ER_')) {
        return res.status(500).json({
            success: false,
            error: 'Database Error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred with the database'
        });
    }

    // Default error
    const message = err.message || 'Internal Server Error';
    res.status(err.status || 500).json({
        success: false,
        error: message,
        message: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 handler
const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
    });
};

module.exports = { errorHandler, notFound };
