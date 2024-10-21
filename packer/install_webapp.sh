#!/bin/bash

set -e  # Exit on any error

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Step 1: Update packages and install dependencies
log_message "Step 1: Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip mysql-server

# Step 2: Configure MySQL server
log_message "Configuring MySQL server..."

# Enable and start MySQL service
log_message "Starting MySQL service..."
sudo systemctl enable mysql
sudo systemctl start mysql

# Configure MySQL
log_message "Configuring MySQL..."
sudo mysql -u root -p'Parna.coM001'<<EOF
CREATE DATABASE IF NOT EXISTS health_check;
SELECT user, host, plugin FROM mysql.user WHERE user = 'root';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Parna.coM001';
FLUSH PRIVILEGES;
SHOW DATABASES;
SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'health_check';
EOF

log_message "MySQL configuration completed."

# Verify MySQL connection
log_message "Verifying MySQL connection..."
if mysql -u root -p'Parna.coM001' -e "SHOW DATABASES;" > /dev/null 2>&1; then
    log_message "MySQL connection successful."
else
    log_message "Error: Unable to connect to MySQL. Check the error log for details."
    exit 1
fi
# sudo mysql -u root <<EOF
# ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Parna.coM001';
# FLUSH PRIVILEGES;
# CREATE DATABASE IF NOT EXISTS health_check;
# EOF

log_message "MySQL security configuration completed."

log_message "Contents of /tmp before unzipping:"
ls -la /tmp

# # Step 3: Unzip webapp.zip to /opt/webapp
# log_message "Unzipping webapp.zip to /opt/webapp..."
# sudo mkdir -p /opt/webapp
# sudo unzip /opt/webapp.zip -d /opt/webapp

# List contents to verify the extraction
log_message "Listing files in /opt/webapp..."
sudo ls -la /opt/webapp

# Step 4: Navigate to the webapp directory
cd /opt/webapp || exit 1


# Check if package.json exists
if [ ! -f package.json ]; then
    log_message "Error: package.json not found!"
    exit 1
fi

# Step 5: Create a local system user 'csye6225'
log_message "Creating local system user 'csye6225'..."
sudo useradd -r -s /usr/sbin/nologin csye6225

# Ensure csye6225 has the correct permissions for its home directory
sudo mkdir -p /home/csye6225
sudo chown csye6225:csye6225 /home/csye6225
# Step 6: Set ownership of /opt/webapp to csye6225
log_message "Setting ownership of /opt/webapp to csye6225..."
sudo chown -R csye6225:csye6225 /opt/webapp


# Step 7: Install Node.js dependencies
log_message "Installing Node.js dependencies..."
sudo -u csye6225 bash -c 'cd /opt/webapp && npm install'
sudo npm uninstall bcrypt
sudo npm install bcrypt
sudo -u csye6225 npx sequelize-cli db:migrate

echo "Contents of .env file:"
cat /opt/webapp/.env
sudo chmod 644 /opt/webapp/.env
sudo chown csye6225:csye6225 /opt/webapp/.env
sudo -u csye6225 printenv


# Step 8: Copy and enable the systemd service file
sudo mv /opt/webapp/my-app.service /etc/systemd/system/my-app.service
sudo chown root:root /etc/systemd/system/my-app.service
sudo systemctl daemon-reload
sudo systemctl enable my-app.service
sudo systemctl start my-app.service || { log_message "Failed to satrt servise"; exit 1;}
sudo systemctl status my-app.service
sudo journalctl -xeu my-app.service

# List contents of /opt/webapp--------
log_message "Contents of /opt/webapp:"
ls -la /opt/webapp

# Log completion message
log_message "Web application setup complete!"

# Exit script successfully
exit 0