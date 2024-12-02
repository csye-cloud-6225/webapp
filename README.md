**RESTful API Health Check**
A simple RESTful API built using Node.js, Express, and Sequelize.

**Project Structure**
index.js
config/database.js - 
routes/healthz.js

**Prerequisites**
- Node.js (v14+)
- NPM: Node Package Manager
- MySQL database
- Sequelize 
- Express
- Environment Variable in a .env file

**Set your environment variables as shown below:**
DB_NAME=your_database_name
USER=your_database_user
PASSWORD=your_database_password
DB_HOST=your_database_host

**Setup**
- Clone your repository
- Install dependencies : `npm install`
- Start the server : `npm start`
- Once the application is running, you can access it at http://localhost:8080
  
**Health Check**
GET /healthz:

curl -X GET http://localhost:8080/healthz
- Returns 200 OK if the database is connected
- Returns 503 Service Unavailable if not
  
HEAD /healthz:

curl -X HEAD http://localhost:8080/healthz
Always returns `405 Method Not Allowed`

OPTIONS /healthz:

curl -X OPTIONS http://localhost:8080/healthz
Always returns `405 Method Not Allowed`

**USER ROUTES** (routes/user.js)
The user.js file contains the user-related endpoints and their handlers:
1. POST/v1/user: Endpoint for creating a new user.
- Validates input and checks for duplicate emails.
2. GET/v1/user/self: Endpoint for retrieving authenticated user details.
- Requires Basic Authentication for access.
3. PUT/v1/user/self: Endpoint for updating user information.
- Allows updating first name, last name, and password while validating the fields.

**TESTING**
Unit and integration tests are included in the `tests` directory. 
You can run tests jest - `npm test`

Integration testing
You can run integration tests with the following commands
`node config/setup-test-db.js` - For the database
`npm run test:integration` - To run integration tests

**Continuous Integration (CI)**
The CI workflow is triggered on pull requests to the main branch and performs the following tasks:

1. Sets up the testing environment with Node.js and MySQL.
2. Installs project dependencies.
3. Runs unit tests.
4. Runs integration tests.

The CI configuration can be found in the `.github/workflows` directory of the repository.

1. Make your changes in a new branch.
2. Create a pull request to the main branch.
3. Wait for the CI checks to complete.
4. Review the results and make any necessary adjustments.
5. Once all checks pass, your code is ready for review and merge.
   