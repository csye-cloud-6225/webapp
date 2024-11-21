const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { User,Image } = require('../models'); // Import the User model
const authRoutes = require('../routes/auth'); // Import auth routes
const StatsD = require('node-statsd');
const crypto = require('crypto');
const sns = new AWS.SNS();
const { Op } = require('sequelize'); // Import Op from Sequelize
// Load environment variables from .env file
require('dotenv').config();

// Configure AWS S3
const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket_name = process.env.bucket_name
const statsdClient = new StatsD({ host: process.env.STATSD_HOST || 'localhost', port: 8125 });
// Configure AWS SDK globally with the region from environment variables
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1', // Default to 'us-east-1' if AWS_REGION is not set
});
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

let instanceId = 'localhost';

// Function to retrieve the instance ID using IMDSv2
async function fetchInstanceId() {
    try {
        // Get the IMDSv2 token
        const tokenResponse = await axios.put(
            'http://169.254.169.254/latest/api/token',
            null,
            { headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } }
        );

        const token = tokenResponse.data;

        // Use the token to fetch the instance ID
        const instanceResponse = await axios.get(
            'http://169.254.169.254/latest/meta-data/instance-id',
            { headers: { 'X-aws-ec2-metadata-token': token } }
        );

        instanceId = instanceResponse.data;
        logToFile(`Fetched Instance ID: ${instanceId}`);
    } catch (error) {
        console.warn("Could not retrieve Instance ID. Using 'localhost' as fallback.");
    }
}

// Fetch instance ID at startup
fetchInstanceId();

// Utility function to log metrics to CloudWatch
const logMetric = (metricName, value, unit = 'Milliseconds') => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn(`Skipping metric ${metricName} due to missing AWS credentials.`);
    return;
  }

  const params = {
    MetricData: [
      {
        MetricName: metricName,
        Dimensions: [{ Name: 'InstanceId', Value: instanceId || 'localhost' }],
        Unit: unit,
        Value: value,
      },
    ],
    Namespace: 'WebAppMetrics',
  };

  const cloudwatch = new AWS.CloudWatch();
  cloudwatch.putMetricData(params, (err) => {
    if (err) console.error(`Failed to push metric ${metricName}: ${err}`);
  });
};
// Function to time database and S3 operations
const timedOperation = async (operation, metricPrefix) => {
  const start = Date.now();
   // Log count metric for each operation
   logMetric(`${metricPrefix}_Count`, 1, 'Count');  // Only in timedOperation

  const result = await operation();
  const duration = Date.now() - start;
  logMetric(`${metricPrefix}_ExecutionTime`, duration);
  statsdClient.timing(`${metricPrefix}.execution_time`, duration);
  return result;
};

// Middleware to time API calls and increment count in StatsD
router.use((req, res, next) => {
  const start = Date.now();
  // console.log(`API Hit: ${req.method} ${req.path}`);
  // Create a consistent metric name
  const metricName = `API_${req.method}_${req.path.replace(/\//g, '_')}`;
  statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);
  // Log count metric to CloudWatch
  logMetric(`${metricName}_Count`, 1, 'Count');
  res.on('finish', () => {
      const duration = Date.now() - start;
      logMetric(`${metricName}_ExecutionTime`, duration);
      statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.execution_time`, duration);
  });
  next();
});
const timedS3Operation = async (operation, params) => {
  const start = Date.now();
  const result = await s3[operation](params).promise();
  const duration = Date.now() - start;
  logMetric(`S3_${operation}_ExecutionTime`, duration);  // Logs to CloudWatch
  statsdClient.timing(`s3.${operation}.execution_time`, duration);  // Logs to StatsD
  return result;
};
// Middleware to check for query parameters
const checkForQueryParams = (req, res, next) => {
  if (Object.keys(req.query).length > 0) {
      return res.status(400).json();
  }
  next();
};
// Middleware to handle 405 Method Not Allowed for specific routes
const methodNotAllowed = (req, res, next) => {
  if (req.method === 'PUT' && req.originalUrl === '/v1/user/self/pic') {
    return res.sendStatus(405); // Method Not Allowed
  }
  next();
};

// Apply the middleware to /user/self/pic route
router.use('/user/self/pic', methodNotAllowed);
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
  
  const verifyUser = async (req, res) => {
    const { token } = req.query;
  
    console.log("Verification process started"); // Log when verification starts
    console.log("Received token:", token); // Log the received token
  
    if (!token) {
      console.error("Verification token is missing in the request");
      return res.status(400).json({ error: "Verification token is required" });
    }
  
    try {
      console.log("Looking for a user with the provided token...");
      const user = await User.findOne({
        where: {
          verification_token: token,
          verification_expiry: {
            [Op.gt]: new Date(),
          },
        },
      });
  
      if (!user) {
        console.log("No user found with a valid or non-expired token.");
  
        // Check if the email associated with the token is already verified
        const verifiedUser = await User.findOne({
          where: { verification_token: null, is_verified: true },
        });
  
        if (verifiedUser) {
          console.log("User with this email is already verified.");
          return res.status(403).json({ error: "Email already verified" });
        }
  
        return res.status(400).json({ error: "Invalid or expired token" });
      }
  
      console.log("User found:", {
        userId: user.id,
        email: user.email,
        is_verified: user.is_verified,
      });
  
      // Update user fields for verification
      console.log("Updating user verification status...");
      user.is_verified = true;
      user.verification_token = null;
      user.verification_expiry = null;
  
      await user.save();
      console.log("User verification updated successfully:", {
        userId: user.id,
        email: user.email,
        is_verified: user.is_verified,
      });
  
      return res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("An error occurred during the verification process:", {
        errorMessage: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  };
  
  
router.get('/user/self/verify', verifyUser);

const checkEmailVerified = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming `req.user` is set by `authenticateBasic`

    // Find the user in the database
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the email is verified
    if (!user.is_verified) {
      return res.status(403).json();
    }

    next(); // Email is verified; proceed to the next middleware or route handler
  } catch (error) {
    console.error("Error checking email verification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


router.get('/user/self', authenticateBasic, checkForQueryParams, checkEmailVerified, async (req, res) => {
  try {
      console.log('Received request for /user/self'); // Log request received
      console.log('Authenticated user:', req.user); // Log authenticated user info

      // Check if the request has any payload (i.e., req.body is not empty)
      if (Object.keys(req.body).length > 0) {
          console.log('Request contains payload, which is not allowed.');
          return res.status(400).json({ error: "Request body not allowed for GET" });
      }

      const userId = req.user.id;

      console.log('Fetching user details from database for userId:', userId); // Log user ID being fetched
      const user = await timedOperation(() =>
          User.findByPk(userId, {
              attributes: { exclude: ['password'] } // Exclude the password field
          }), 'DBQuery');

      if (!user) {
          console.log('User not found in database for userId:', userId); // Log if user not found
          return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('User details retrieved successfully:', user); // Log retrieved user details
      return res.status(200).json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          account_created: user.account_created,
          account_updated: user.account_updated
      });
  } catch (error) {
      console.error('Error in /user/self endpoint:', error); // Log unexpected errors
      return res.status(500).json({ error: "Internal server error" });
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
    const existingUser = await timedOperation(() => User.findOne({ where: { email } }), 'DBQuery');
    if (existingUser) {
      return res.status(400).json();
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds); // Hash password

    // Generate a unique verification token and expiry timestamp
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry

    // Create the new user in the database with the token and expiry
    const newUser = await timedOperation(() =>
      User.create({
        email,
        firstName,
        lastName,
        password,
        verification_token: verificationToken,
        verification_expiry: verificationTokenExpiry,
      }),
      'DBQuery'
    );
    // Generate the complete verification link
    const verificationLink = `${req.protocol}://${req.get('host')}/v1/user/self/verify?token=${verificationToken}`;
    // Publish to SNS
    const snsMessage = JSON.stringify({
      email,
      verificationLink,
      verificationToken,
      verificationTokenExpiry, // Include the expiry in the message for reference
    });

    const params = {
      Message: snsMessage,
      TopicArn: process.env.SNS_TOPIC_ARN, // Replace with your SNS topic ARN
    };
    console.log("Publishing to SNS with params:", params);
    //await sns.publish(params).promise();
    try {
      await sns.publish(params).promise();
      console.log("SNS publish succeeded");
    } catch (error) {
      console.error("SNS publish failed:", error);
    }

    // Return the user info excluding the password
    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      account_created: newUser.account_created,
      account_updated: newUser.account_updated,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to verify the email
// router.get('/verify-email', async (req, res) => {
//   try {
//     const { token } = req.query;

//     // Find user by token
//     const user = await User.findOne({ where: { emailVerificationToken: token } });
//     if (!user) {
//       return res.status(400).json({ message: 'Invalid or expired token' });
//     }

//     // Update the user to mark email as verified
//     await user.update({
//       isEmailVerified: true,
//       emailVerificationToken: null, // Clear the token after verification
//     });

//     return res.status(200).json({ message: 'Email verified successfully!' });
//   } catch (error) {
//     return res.status(500).json();
//   }
// });

// PUT /user/self - Update user information
router.put('/user/self', authenticateBasic, checkForQueryParams, checkEmailVerified, async (req, res) => {
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

        const user = await timedOperation(()=>User.findByPk(userId),'DBQuery');
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
        await timedOperation(() => user.save(), 'DBQuery');

        // Respond with 204 No Content (no body)
        return res.status(204).send(); // Change this line
    } catch (error) {
        return res.status(500).json();
    }
});
// POST /v1/user/self/pic - Upload profile picture
router.post('/user/self/pic', authenticateBasic,checkEmailVerified, upload.single('profilePic'), async (req, res) => {
  const userId = req.user.id;
  console.log('user is is ',userId);
  
  try {
        const user = await User.findByPk(userId);
      // Check if the user already has a profile picture
      const existingPicture = await timedOperation(() => Image.findOne({ where: { userId} }), 'DBQuery');
      if (existingPicture) {
          // If the user already has a profile picture, return 400 Bad Request
          return res.status(400).json();
      }

      // Generate a unique file name for the S3 object
      const fileName = `${Date.now()}-${req.file.originalname}`;
      // console.log('originalname is this below ',req.file.originalname); 
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
      const data = await timedOperation(() => s3.upload(uploadParams).promise(), 'S3Upload');
      const imageUrl = data.Location;
      //create a new record
      const newImage = await timedOperation(() => Image.create({
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
        }),
        'DBQuery'
      );
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
      // console.error('Error uploading profile picture:', error);
      res.status(500).json();
  }
});

//GET
router.get('/user/self/pic',authenticateBasic,checkEmailVerified, async(req,res) => {
        try{
          const profilePicture = await timedOperation(() => Image.findOne({ where: { userId: req.user.id}}), 'DBQuery');
          if(!profilePicture){
             return res.status(404).json({error:'profile picture not found'});
          }
          res.status(200).json({
            profilePicUrl: profilePicture.profilePicUrl,
            profilePicMetadata: profilePicture.metadata,
            message: 'Profile picture retrieved successfully' });
        }catch(error){
          console.log(error, 'errro retrieving profile pic');
          res.status(500).json();
        }
}); 

// DELETE /v1/user/self/pic - Delete profile picture
router.delete('/user/self/pic', authenticateBasic,checkEmailVerified, async (req, res) => {
  try {
    const profilePicture = await timedOperation( () => Image.findOne({ where: { userId: req.user.id } }), 'DBQuery');
    if (!profilePicture) {
      return res.status(404).json();
    }
    console.log('deleting key: ',profilePicture.key);
    const deleteParams = {
      Bucket: bucket_name,
      Key: profilePicture.key,
    };
    await timedOperation(() => s3.deleteObject(deleteParams).promise(), 'S3Delete');
    // Remove the profile picture record from the database
    await timedOperation(() => profilePicture.destroy(), 'DBQuery');

    res.status(204).end();
  } catch (error) {
    res.status(500).json();
  }
});



module.exports = router;
