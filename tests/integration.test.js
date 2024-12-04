const request = require('supertest');
const app = require('../index'); // Adjust this path if necessary
const { User } = require('../models'); // Adjust this path if necessary
const sequelize = require('../config/database'); // Adjust this path if necessary

jest.mock('../models', () => {
  const SequelizeMock = require('sequelize-mock');
  const dbMock = new SequelizeMock();

  const UserMock = dbMock.define('User', {
    id: 1,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: '$2b$10$abcdefghijklmnopqrstuv', // bcrypt hashed password
    is_verified: true,
  });

  return {
    User: UserMock,
  };
});

jest.mock('../config/database', () => {
  const SequelizeMock = require('sequelize-mock');
  const dbMock = new SequelizeMock();
  dbMock.authenticate = jest.fn().mockResolvedValue();
  dbMock.sync = jest.fn().mockResolvedValue();
  dbMock.close = jest.fn().mockResolvedValue();
  return dbMock;
});

describe('User API Integration Tests', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /v1/user', () => {
    it('should return 400 when creating a new user', async () => {
      const newUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      };

      const response = await request(app).post('/v1/user').send(newUser);

      expect(response.status).toBe(400);
    });

    it('should return 400 for duplicate email', async () => {
      const duplicateUser = {
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        password: 'password456',
      };

      const response = await request(app).post('/v1/user').send(duplicateUser);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /v1/v2/user/self', () => {
    it('should return 401 when attempting to get authenticated user data with invalid credentials', async () => {
      const response = await request(app)
        .get('/v1/v2/user/self')
        .set(
          'Authorization',
          'Basic ' + Buffer.from('test@example.com:wrongpassword').toString('base64')
        );

      expect(response.status).toBe(401);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/v1/v2/user/self');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /v1/user/self', () => {
    it('should return 401 when updating user information without valid credentials', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const response = await request(app)
        .put('/v1/user/self')
        .set(
          'Authorization',
          'Basic ' + Buffer.from('test@example.com:wrongpassword').toString('base64')
        )
        .send(updateData);

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid update fields', async () => {
      const invalidUpdate = {
        email: 'newemail@example.com',
      };

      const response = await request(app)
        .put('/v1/user/self')
        .set(
          'Authorization',
          'Basic ' + Buffer.from('test@example.com:wrongpassword').toString('base64')
        )
        .send(invalidUpdate);

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid user data', async () => {
      const invalidUser = {
        email: 'invalid-email',
        firstName: '',
        lastName: '',
        password: 'short',
      };

      const response = await request(app).post('/v1/user').send(invalidUser);

      expect(response.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .get('/v1/v2/user/self')
        .set(
          'Authorization',
          'Basic ' + Buffer.from('test@example.com:wrongpassword').toString('base64')
        );

      expect(response.status).toBe(401);
    });
  });
});
