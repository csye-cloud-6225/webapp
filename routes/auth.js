const bcrypt = require('bcrypt'); // Ensure bcrypt is imported for password hashing
const { User } = require('../models'); // Adjust the path based on your structure

const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    try {
        // Check if authorization header is present
        if (!authHeader) {
            return res.sendStatus(401); // Unauthorized
        }

        // Handle Basic Authentication
        if (authHeader.startsWith('Basic ')) {
            const base64Credentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
            const [email, password] = credentials.split(':').map(item => item.trim());

            // Validate user credentials
            const user = await User.findOne({ where: { email } });
            
            if (!user) {
                return res.status(401).json();
            }

            // Check password
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                
                return res.status(401).json();
            }

            // Store user ID and other user details in req.user
            req.user = { id: user.id, email: user.email }; // Add any other user info as needed
            
            return next(); // Proceed to the next middleware
        }

        // If the authorization type is not Basic, return unauthorized
        return res.sendStatus(401); // Unauthorized

    } catch (error) {
        
        return res.status(500).json();
    }
};

module.exports = authenticate;
