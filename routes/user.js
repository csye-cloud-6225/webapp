const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { User } = require('../models'); // Import the User model
const authRoutes = require('../routes/auth'); // Import auth routes

// Load environment variables from .env file
require('dotenv').config();

// Configure AWS S3
const s3 = new AWS.S3({
    region: process.env.aws_region,
  });
  
  // Set up Multer to upload to S3
  const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.bucket_name,
      key: (req, file, cb) => {
        const filename = `profile-pictures/${Date.now()}_${file.originalname}`;
        cb(null, filename);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type! Only JPEG, PNG, and JPG are allowed.'));
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  });
  
// Middleware to check for query parameters
const checkForQueryParams = (req, res, next) => {
  if (Object.keys(req.query).length > 0) {
      return res.status(400).json();
  }
  next();
};

const saltRounds = 10; // Define salt rounds globally

const authenticateBasic = async (req, res, next) => {
  const unsupportedMethods = ['HEAD', 'PATCH', 'OPTIONS', 'DELETE'];

  if (unsupportedMethods.includes(req.method)) {
      return res.sendStatus(405); // Method Not Allowed
  }

  const authHeader = req.headers['authorization'];
  // console.log('Incoming request headers:', req.headers);

  try {
      if (!authHeader || !authHeader.startsWith('Basic ')) {
          // console.log('No authorization header found or not Basic Auth');
          return res.status(401).json();  // Unauthorized
      }

      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [email, password] = credentials.split(':').map(field => field.trim());

      const user = await User.findOne({ where: { email } });

      // Check if user exists before comparing passwords
      if (!user) {
          return res.status(401).json();
      }

      // Compare the entered password with the hashed password
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
          return res.status(401).json();
      }

      req.user = { id: user.id, email: user.email }; // Store user info in req.user
      next();
  } catch (error) {
      return res.status(500).json();
  }
};

router.get('/user/self', authenticateBasic, checkForQueryParams, async (req, res) => {
  try {
    // Check if the request has any payload (i.e., req.body is not empty)
    if (Object.keys(req.body).length > 0) {
      return res.status(400).json();
    }

    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] } // Exclude the password field
    });

    if (!user) {
      return res.status(401).json();
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
    return res.status(500).json();
  }
});

// POST /user/self - Create a new user
router.post('/user', checkForQueryParams, async (req, res) => {
  try {
      const { email, firstName, lastName, password } = req.body; // Get user data from request body

      // Validate email
      if (!email || typeof email !== 'string' || !email.trim() || !/\S+@\S+\.\S+/.test(email)) {
          return res.status(400).json();
      }

      // Validate first name
      if (!firstName || typeof firstName !== 'string' || !firstName.trim() || !/^[A-Za-z]+$/.test(firstName)) {
          return res.status(400).json();
      }

      // Validate last name
      if (!lastName || typeof lastName !== 'string' || !lastName.trim() || !/^[A-Za-z]+$/.test(lastName)) {
          return res.status(400).json();
      }

      // Validate password
      if (!password || typeof password !== 'string' || password.length < 6) {
          return res.status(400).json();
      }

      // Check if email already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
          return res.status(400).json();
      }

      const hashedPassword = await bcrypt.hash(password, saltRounds); // Hash password
      // Create the new user in the database
      const newUser = await User.create({
          email,
          firstName,
          lastName,
          password
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
      return res.status(400).json();
  }
});

// PUT /user/self - Update user information
router.put('/user/self', authenticateBasic, checkForQueryParams, async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, password, email, account_created, account_updated, ...extraFields } = req.body;

        // List of allowed fields
        const allowedFields = ['firstName', 'lastName', 'password'];
        const invalidFields = Object.keys(extraFields);

        // Check for invalid fields
        if (invalidFields.length > 0) {
            return res.status(400).json();
        }

        // Check if email or timestamps are being updated
        if (email) {
            return res.status(400).json();
        }

        if (account_created || account_updated) {
            return res.status(400).json();
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(401).json(); // Adjusted to match your tests
        }

        // Update fields if provided
        if (firstName) {
            user.firstName = firstName;
        }

        if (lastName) {
            user.lastName = lastName;
        }

        if (password) {
            user.password = await bcrypt.hash(password, saltRounds); // Hash the new password
        }

        // Update the account_updated field with the current timestamp
        user.account_updated = new Date();

        // Save the updated user info
        await user.save();

        // Respond with 204 No Content (no body)
        return res.status(204).send(); // Change this line
    } catch (error) {
        return res.status(500).json();
    }
});
router.post('/user/self/profile-picture', authenticateBasic, upload.single('image'), async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from the authenticated user
        const user = await User.findByPk(userId); // Find the user by ID

        if (!user) return res.status(401).json({ error: 'User not found.' }); // User not found

        // Save the S3 file URL to the user's profilePicture field
        user.fileName = req.file.originalname; // Get the URL from the uploaded file
        user.url = req.file.location; // Get the URL from the uploaded file
        user.upload_date = new Date(); // Set the upload date
        await user.save(); // Save the updated user info

        return res.status(200).json({ fileName: user.fileName, url: user.url }); // Return the URL
    } catch (error) {
        console.error('Upload error:', error); // Log the error for debugging
        return res.status(500).json({ error: 'Failed to upload image.' }); // Return server error
    }
});
// Delete profile picture from S3
router.delete('/user/self/profile-picture', authenticateBasic, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user || !user.url) return res.status(404).json({ error: 'Profile picture not found.' }); // User not found or no profile picture

        // Extract the S3 key from the URL
        const key = user.url.split('.amazonaws.com/')[1];

        // Delete the object from S3
        await s3.deleteObject({
            bucket: process.env.bucket_name, // Replace with your S3 bucket name
            Key: key,
        }).promise();

        user.fileName = null; // Clear the file name
        user.url = null; // Clear the URL
        await user.save(); // Save the updated user info

        return res.status(204).send(); // No Content
    } catch (error) {
        console.error('Delete error:', error); // Log the error for debugging
        return res.status(500).json({ error: 'Failed to delete image.' }); // Return server error
    }
});

  // GET /user/self/profile-picture - Get user's profile picture
router.get('/user/self/profile-picture', authenticateBasic, async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from the authenticated user
        const user = await User.findByPk(userId); // Find the user by ID

        if (!user || !user.profilePicture) {
            return res.status(404).json({ error: 'Profile picture not found.' }); // User or picture not found
        }

        const fileUrl = user.profilePicture; // Get the S3 URL of the profile picture
        const uploadDate = user.upload_date; // Assuming account_updated is the upload date
        const fileName = fileUrl.split('/').pop(); // Extract the filename from the URL

        return res.status(200).json({
            file_name: fileName,
            id: userId, // The user's ID
            url: fileUrl, // The S3 URL
            upload_date: user.uploadDate,
            user_id: userId // User ID
        });
    } catch (error) {
        console.error('Error fetching profile picture:', error); // Log the error for debugging
        return res.status(500).json({ error: 'Failed to fetch profile picture.' }); // Return server error
    }
});


// Handle unsupported HTTP methods and return 405 Method Not Allowed
router.all('/self', (req, res) => {
  return res.status(405).json(); // Method Not Allowed
});

module.exports = router;
