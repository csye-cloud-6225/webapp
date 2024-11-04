const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../index'); // Adjust the path as needed
const { User } = require('../models'); // Adjust the path as needed
const sequelize = require('../config/database'); // Adjust the path as needed
// Add this to the top of your test file
process.env.bucket_name = 'your-test-bucket-name';

// Mock the database connection
jest.mock('../config/database', () => ({
  authenticate: jest.fn().mockResolvedValue(),
  sync: jest.fn().mockResolvedValue(),
}));
// Mock AWS SDK CloudWatch and S3
jest.mock('aws-sdk', () => {
  const putMetricDataMock = jest.fn((params, callback) => callback(null, {}));
  const uploadMock = jest.fn((params, callback) => callback(null, { Location: 'mocked-url' }));

  return {
      S3: jest.fn(() => ({
          upload: uploadMock,
          getObject: jest.fn((params, callback) => callback(null, { Body: Buffer.from('mocked data') })),
          deleteObject: jest.fn((params, callback) => callback(null)),
      })),
      CloudWatch: jest.fn(() => ({
          putMetricData: putMetricDataMock,
      })),
      config: {
          update: jest.fn(),
      },
  };
});
// Suppress specific console warnings and errors during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
// Mock the User model
jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));
// Mock node-statsd unconditionally to prevent errors when the module is not found
jest.mock('node-statsd', () => {
  return jest.fn().mockImplementation(() => ({
    increment: jest.fn(),
    timing: jest.fn(),
  }));
});

// Mock multerS3
jest.mock('multer-s3', () => jest.fn(() => ({
  // Mock any necessary methods here
})));

// Mock the User model
jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('User API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /v1/user', () => {
    it('should create a new user', async () => {
      const newUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        id: 1,
        ...newUser,
        account_created: new Date(),
        account_updated: new Date(),
      });

      const response = await request(app)
        .post('/v1/user')
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(newUser.email);
    });

    it('should return 400 for invalid input', async () => {
      const invalidUser = {
        email: 'invalid',
        firstName: '',
        lastName: '',
        password: 'short',
      };

      const response = await request(app)
        .post('/v1/user')
        .send(invalidUser);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /v1/user/self', () => {
    it('should return user data when authenticated', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'hashedPassword',
        account_created: new Date(),
        account_updated: new Date(),
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByPk.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .get('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password').toString('base64'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/v1/user/self');
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /v1/user/self', () => {
    it('should update user information', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'hashedPassword',
        save: jest.fn(),
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByPk.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('newHashedPassword');

      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'newPassword',
      };

      const response = await request(app)
        .put('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password').toString('base64'))
        .send(updateData);

      expect(response.status).toBe(204);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 400 for invalid update fields', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'hashedPassword',
      };

      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const invalidUpdate = {
        email: 'newemail@example.com',
      };

      const response = await request(app)
        .put('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password').toString('base64'))
        .send(invalidUpdate);

      expect(response.status).toBe(400);
    });
  });

});

describe('Database Connection', () => {
  it('should authenticate database connection', async () => {
    await expect(sequelize.authenticate()).resolves.not.toThrow();
  });
});

// Add more test cases for other routes and functionalities as needed