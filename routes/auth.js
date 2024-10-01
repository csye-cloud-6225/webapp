const bcrypt = require('bcrypt'); // Ensure bcrypt is imported for password hashing
const { User } = require('../models'); // Adjust the path based on your structure

const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log('Incoming request headers:', req.headers); // Log the entire headers for debugging

    try {
        // Check if authorization header is present
        if (!authHeader) {
            console.log('No authorization header found');
            return res.sendStatus(401); // Unauthorized
        }

        // Handle Basic Authentication
        if (authHeader.startsWith('Basic ')) {
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
            const [email, password] = credentials.split(':');

            // Validate user credentials
            const user = await User.findOne({ where: { email } });
            if (!user || !(await bcrypt.compare(password, user.password))) {
                console.log('Invalid Basic credentials provided');
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Store user ID and other user details in req.user
            req.user = { id: user.id, email: user.email }; // Add any other user info as needed
            console.log('Basic Auth successful, proceeding with user ID:', user.id);
            return next(); // Proceed to the next middleware
        }

        // If the authorization type is not Basic, return unauthorized
        return res.sendStatus(401); // Unauthorized

    } catch (error) {
        console.error('Error in authentication middleware:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = authenticate;
