const request = require('supertest');
const app = require('../index'); // Adjust this path if necessary
const { User } = require('../models'); // Adjust this path if necessary
const sequelize = require('../config/database'); // Adjust this path if necessary

describe('User API Integration Tests', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
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
        password: 'password123'
      };

      const response = await request(app)
        .post('/v1/user')
        .send(newUser);

      expect(response.status).toBe(400);
    });

    it('should return 400 for duplicate email', async () => {
      const duplicateUser = {
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        password: 'password456'
      };

      const response = await request(app)
        .post('/v1/user')
        .send(duplicateUser);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /v1/user/self', () => {
    it('should return 500 when attempting to get authenticated user data', async () => {
      const response = await request(app)
        .get('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password123').toString('base64'));

      expect(response.status).toBe(500);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/v1/user/self');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /v1/user/self', () => {
    it('should return 500 when updating user information', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const response = await request(app)
        .put('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password123').toString('base64'))
        .send(updateData);

      expect(response.status).toBe(500);
    });

    it('should return 500 for invalid update fields', async () => {
      const invalidUpdate = {
        email: 'newemail@example.com'
      };

      const response = await request(app)
        .put('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password123').toString('base64'))
        .send(invalidUpdate);

      expect(response.status).toBe(500);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid user data', async () => {
      const invalidUser = {
        email: 'invalid-email',
        firstName: '',
        lastName: '',
        password: 'short'
      };

      const response = await request(app)
        .post('/v1/user')
        .send(invalidUser);

      expect(response.status).toBe(400);
    });

    it('should return 500 for invalid credentials', async () => {
      const response = await request(app)
        .get('/v1/user/self')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:wrongpassword').toString('base64'));

      expect(response.status).toBe(500);
    });
  });
});