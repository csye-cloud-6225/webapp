require('dotenv').config({path:`${process.cwd()}/.env`});  // Make sure to require dotenv

module.exports = {
  "development": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASSWORD, // Default for development
    "database": process.env.DB_NAME,
    "host": process.env.DB_HOST,
    "aws_region":process.env.aws_region,
    "bucket_name":process.env.bucket_name,
    "dialect": "mysql",
    logging: false
  },
  "test": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DB_NAME,
    "host": process.env.DB_HOST,
    "aws_region":process.env.aws_region,
    "bucket_name":process.env.bucket_name,
    "dialect": "mysql",
    logging: false
  },
  "production": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DB_NAME,
    "host": process.env.DB_HOST,
    "aws_region":process.env.aws_region,
    "bucket_name":process.env.bucket_name,
    "dialect": "mysql",
    logging: false
  }
};
