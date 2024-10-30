const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { User,Image } = require('../models'); // Import the User model
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
// Middleware to check DELETE method
const restrictDeleteOnSelf = (req, res, next) => {
  if (req.method === 'DELETE' && req.originalUrl ==='/v1/user/self') {
    return res.sendStatus(405); // Method Not Allowed
  }
  next(); // Proceed to the next middleware/route handler
};

// Apply the middleware to the /user/self route
router.use('/user/self', restrictDeleteOnSelf);

const saltRounds = 10; // Define salt rounds globally

const authenticateBasic = async (req, res, next) => {
const unsupportedMethods = ['HEAD', 'PATCH', 'OPTIONS'];
  // Check if the method is unsupported
  if (unsupportedMethods.includes(req.method)) {
    return res.sendStatus(405); // Method Not Allowed
}

// Allow DELETE requests to /user/self/profile-picture without authentication
//if (req.method === 'DELETE' && req.originalUrl === '/user/self/pic') {
//   console.log('req.orginalurl', req.originalUrl);
//   console.log('allowing delete req to /user/self/pic');
//    return next(); // Allow this specific DELETE request
//}

// Reject DELETE requests to any other routes
//if (req.method === 'DELETE') {
//    return res.sendStatus(403); // Forbidden for all other DELETE requests
//}

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
  console.log('user is is ',userId);
  
  try {
        const user = await User.findByPk(userId);
      // Check if the user already has a profile picture
      const existingPicture = await Image.findOne({ where: { userId} });
      if (existingPicture) {
          // If the user already has a profile picture, return 400 Bad Request
          return res.status(400).json({ error: 'Profile picture already exists. Delete it before uploading a new one.' });
      }

      // Generate a unique file name for the S3 object
      const fileName = `${Date.now()}-${req.file.originalname}`;
      console.log('originalname is this below ',req.file.originalname); 
      const uploadParams = {
          Bucket: bucket_name,
          Key: `user-profile-pics/${userId}/${fileName}`,  // Unique key for each file
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          Metadata: {
              userId: String(userId),
          },
      };

      // Upload the image to S3
      const data = await s3.upload(uploadParams).promise();
      const imageUrl = data.Location;
      //create a new record
      const newImage = await Image.create({
        userId,
        profilePicUrl: imageUrl,
        key: uploadParams.Key,
        profilePicOriginalName: req.file.originalname,
        profilePicUploadedAt: new Date(),
        metadata: {
          profilePicOriginalName: req.file.originalname,
          content_type: req.file.mimetype,
          upload_date: new Date().toISOString(),
        },
      });
      await user.setProfileImage(newImage);
      // Update user with profile picture URL
      user.profilePicUrl = imageUrl;
      user.profilePicOriginalName = req.file.originalname; // Save original name
      await user.save();
      const profilePicOriginalName = req.file.originalname;
      res.status(201).json({
          message: 'Profile picture uploaded successfully',
          id: newImage.id,
          user_id: userId,
          profilePicOriginalName,
          imageUrl,
      });
  } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(500).json({ error: 'Error uploading profile picture' });
  }
});

//GET
router.get('/user/self/pic',authenticateBasic, async(req,res) => {
        try{
          const profilePicture = await Image.findOne({ where: { userId: req.user.id}});
          if(!profilePicture){
             return res.status(404).json({error:'profile picture not found'});
          }
          res.status(200).json({
            profilePicUrl: profilePicture.profilePicUrl,
            profilePicMetadata: profilePicture.metadata,
            message: 'Profile picture retrieved successfully' });
        }catch(error){
          console.log(error, 'errro retrieving profile pic');
          res.status(500).json({error: 'error retrieving profile pic'});
        }
}); 

// DELETE /v1/user/self/pic - Delete profile picture
router.delete('/user/self/pic', authenticateBasic, async (req, res) => {
  try {
    const profilePicture = await Image.findOne({ where: { userId: req.user.id } });
    if (!profilePicture) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }
    console.log('deleting key: ',profilePicture.key);
    const deleteParams = {
      Bucket: bucket_name,
      Key: profilePicture.key,
    };

    await s3.deleteObject(deleteParams).promise();

    // Remove the profile picture record from the database
    await profilePicture.destroy();

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: 'Error deleting profile picture' });
  }
});



module.exports = router;