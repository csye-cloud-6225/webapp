const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const { User } = require('../models'); // Import the User model
const authRoutes = require('../routes/auth'); // Import auth routes

// Use the auth routes
router.use('/auth', authRoutes);

// Middleware for Basic Authentication
const authenticateBasic = async (req, res, next) => {
    // List of unsupported HTTP methods
    const unsupportedMethods = ['HEAD', 'PATCH', 'OPTIONS', 'DELETE'];
  
    // Check if the request method is unsupported
    if (unsupportedMethods.includes(req.method)) {
    //   console.log(`Method ${req.method} not allowed`);
      return res.sendStatus(405); // Method Not Allowed
    }
  
    const authHeader = req.headers['authorization'];
    console.log('Incoming request headers:', req.headers);
  
    try {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.log('No authorization header found or not Basic Auth');
        return res.sendStatus(401); // Unauthorized
      }
  
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [email, password] = credentials.split(':');
  
      // Validate user credentials
      const user = await User.findOne({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        console.log('Invalid Basic credentials provided');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      req.user = { id: user.id, email: user.email }; // Store user info in req.user
      console.log('Basic Auth successful for user ID:', user.id);
      next();
    } catch (error) {
      console.error('Error in Basic authentication middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
  

// GET user info for authenticated user
router.get('/self', authenticateBasic, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Fetching user info for userId:', userId);

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] } // Exclude the password field
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      account_created: user.account_created,
      account_updated: user.account_updated
    });
  } catch (error) {
    console.error('Error fetching user information:', error);
    return res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

/// POST /user/self - Create a new user
router.post('/self', async (req, res) => {
    try {
      const { email, firstName, lastName, password } = req.body; // Get user data from request body
      const hashedPassword = await bcrypt.hash(password, 10); // Hash password
      
      // Create the new user in the database
      const newUser = await User.create({
        email, firstName, lastName, password: hashedPassword
      });
  
      // Return the user info excluding the password
      return res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        account_created: newUser.account_created,
        account_updated: newUser.account_updated
      });
    } catch (error) {

      return res.status(400).json({ error: 'Failed to create user' });
    }
  });
  

// PUT /user/self - Update user information
router.put('/self', authenticateBasic, async (req, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, password, email } = req.body;
  
      // Check if an attempt is made to update fields other than firstName, lastName, and password
      if (email) {
        return res.status(400).json({ error: 'Email cannot be updated' });
      }
  
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Update firstName if provided
      if (firstName) {
        user.firstName = firstName;
      }
  
      // Update lastName if provided
      if (lastName) {
        user.lastName = lastName;
      }
  
      // Update password if provided
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the new password
        user.password = hashedPassword;
      }
  
      // Update the account_updated field with the current timestamp
      user.account_updated = new Date();
  
      // Save the updated user info
      await user.save();
  
      return res.status(200).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        account_created: user.account_created,
        account_updated: user.account_updated,
      });
    } catch (error) {
      console.error('Error updating user information:', error);
      return res.status(500).json({ error: 'Failed to update user information' });
    }
  });

  // Handle unsupported HTTP methods and return 405 Method Not Allowed
const unsupportedMethods = ['PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// Handle unsupported HTTP methods and return 405 Method Not Allowed
router.all('/self', (req, res) => {
    res.status(405).json();
  });
  

module.exports = router;