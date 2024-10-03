const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const { User } = require('../models'); // Import the User model
const authRoutes = require('../routes/auth'); // Import auth routes

// Use the auth routes
router.use('/auth', authRoutes);

// Middleware to check for query parameters and headers
const checkForQueryParams = (req, res, next) => {
  // Check for query parameters
  if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ error: 'Bad Request: Query parameters are not allowed' });
  }

  // Check for any custom headers (not counting the common ones like Content-Type, Authorization, etc.)
  const disallowedHeaders = Object.keys(req.headers).filter(header => 
      !['content-type', 'authorization'].includes(header.toLowerCase())
  );

  if (disallowedHeaders.length > 0) {
      return res.status(400).json({ error: 'Bad Request: Custom headers are not allowed' });
  }

  next();
};

// Middleware for Basic Authentication
const authenticateBasic = async (req, res, next) => {
    const unsupportedMethods = ['HEAD', 'PATCH', 'OPTIONS', 'DELETE'];

    if (unsupportedMethods.includes(req.method)) {
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

        const user = await User.findOne({ where: { email } });
        const match = await bcrypt.compare(password, user.password);
        console.log('Password match result:', match);

        if (!user || !match) {
            console.log('Invalid Basic credentials provided user file');
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

router.get('/self', authenticateBasic, checkForQueryParams, async (req, res) => {
  try {
    // Check if the request has any payload (i.e., req.body is not empty)
    if (Object.keys(req.body).length > 0) {
      return res.status(400).json({ error: 'Bad Request: No payload is allowed for this endpoint' });
    }

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



// POST /user/self - Create a new user
router.post('/self', checkForQueryParams, async (req, res) => {
  try {
      const { email, firstName, lastName, password } = req.body; // Get user data from request body

      // Validate email
      if (!email || typeof email !== 'string' || !email.trim() || !/\S+@\S+\.\S+/.test(email)) {
          return res.status(400).json({ error: 'Bad Request: Invalid email address' });
      }

      // Validate first name
      if (!firstName || typeof firstName !== 'string' || !firstName.trim() || !/^[A-Za-z]+$/.test(firstName)) {
          return res.status(400).json({ error: 'Bad Request: First name must be alphabetic only' });
      }

      // Validate last name
      if (!lastName || typeof lastName !== 'string' || !lastName.trim() || !/^[A-Za-z]+$/.test(lastName)) {
          return res.status(400).json({ error: 'Bad Request: Last name must be alphabetic only' });
      }

      // Validate password
      if (!password || typeof password !== 'string' || password.length < 6) {
          return res.status(400).json({ error: 'Bad Request: Password must be at least 6 characters long' });
      }

      // Check if email already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
          return res.status(400).json({ error: 'Bad Request: Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10); // Hash password

      // Create the new user in the database
      const newUser = await User.create({
          email,
          firstName,
          lastName,
          password: hashedPassword
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
      console.error('Error creating user:', error);
      return res.status(400).json({ error: 'Failed to create user' });
  }
});

// PUT /user/self - Update user information
router.put('/self', authenticateBasic, checkForQueryParams, async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, password, email, account_created, account_updated, ...extraFields } = req.body;

        // List of allowed fields
        const allowedFields = ['firstName', 'lastName', 'password'];
        const invalidFields = Object.keys(extraFields);

        // Check for invalid fields
        if (invalidFields.length > 0) {
            return res.status(400).json({ error: `Invalid fields: ${invalidFields.join(', ')}` });
        }

        // Check if email or timestamps are being updated
        if (email) {
            return res.status(400).json({ error: 'Email cannot be updated' });
        }

        if (account_created || account_updated) {
            return res.status(400).json({ error: 'Account created and updated timestamps cannot be modified' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedFields = {}; // Object to hold the updated fields

        // Update fields if provided
        if (firstName) {
            user.firstName = firstName;
            updatedFields.firstName = firstName;
        }

        if (lastName) {
            user.lastName = lastName;
            updatedFields.lastName = lastName;
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10); // Hash the new password
            user.password = hashedPassword;
            updatedFields.password = hashedPassword; // Include updated password in the response if needed
        }

        // Update the account_updated field with the current timestamp
        user.account_updated = new Date();

        // Save the updated user info
        await user.save();

        // Respond with 204 No Content and the updated fields
        return res.status(201).json(updatedFields);
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
