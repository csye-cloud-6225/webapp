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
const s3 = new AWS.S3();
const bucket_name = process.env.bucket_name

  // Set up Multer to upload to S3
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },  // Limit file size to 5 MB
    fileFilter: (req, file, cb) => {
      if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only .jpg, .jpeg, and .png formats allowed!'), false);
      }
    },
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
const unsupportedMethods = ['HEAD', 'PATCH', 'OPTIONS'];
  // Check if the method is unsupported
  if (unsupportedMethods.includes(req.method)) {
    return res.sendStatus(405); // Method Not Allowed
}

// Allow DELETE requests to /user/self/profile-picture without authentication
if (req.method === 'DELETE' && req.originalUrl === '/user/self/profile-picture') {
    return next(); // Allow this specific DELETE request
}

// Reject DELETE requests to any other routes
if (req.method === 'DELETE') {
    return res.sendStatus(403); // Forbidden for all other DELETE requests
}

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
// POST /v1/user/self/pic - Upload profile picture
router.post('/user/self/pic', authenticateBasic, upload.single('profilePic'), async (req, res) => {
    const userId = req.user.id;
  
    const uploadParams = {
      Bucket: bucket_name,
      Key: `user-profile-pics/${userId}-${Date.now()}-${req.file.originalname}`,  // Unique key for each file
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        userId: String(userId),
      },
    };
  
    try {
      const data = await s3.upload(uploadParams).promise();
      const imageUrl = data.Location;
      
  
      // Update user with profile picture URL
      const user = await User.findByPk(userId);
      user.profilePicUrl = imageUrl;
      user.profilePicOriginalName = req.file.originalname; // Save original name
      await user.save();
  
      res.status(201).json({
        message: 'Profile picture uploaded successfully',
        imageUrl,
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({ error: 'Error uploading profile picture' });
    }
  });
  
// Delete profile picture from S3
router.delete('/user/self/profile-picture', authenticateBasic, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user || !user.profilePicUrlurl) return res.status(404).json({ error: 'Profile picture not found.' }); // User not found or no profile picture

        // Extract the S3 key from the URL
        const fileKey = user.profilePicUrl.split(`${bucketName}/`)[1];
        const deleteParams = {
            Bucket: bucket_name,
            Key: fileKey,
        };
        await s3.deleteObject(deleteParams).promise();

        //Remove the profile url from user's record
        user.profilePicUrl = null;
        await user.save();
        return res.status(204).send(); // Return 204 No Content
    } catch (error){
        console.error('Error deleting profile picture:', error);
        res.status(500).json({ error: 'Error deleting profile picture' });
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

        // const fileUrl = user.profilePicture; // Get the S3 URL of the profile picture
        // const uploadDate = user.upload_date; // Assuming account_updated is the upload date
        // const fileName = fileUrl.split('/').pop(); // Extract the filename from the URL

        return res.status(200).json({
            profilePicUrl: user.profilePicUrl,
            message: 'profile pic retrieved successfully',
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
