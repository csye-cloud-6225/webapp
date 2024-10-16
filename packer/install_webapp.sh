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

# Set up MySQL database and user
log_message "Setting up MySQL database..."
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${Password}';"
sudo mysql -e "FLUSH PRIVILEGES;"
sudo mysql -u root -p${Password} -e "CREATE DATABASE ${DB_NAME};"

log_message "MySQL security configuration completed."

# Step 3: Unzip webapp.zip to /opt/webapp
log_message "Unzipping webapp.zip to /opt/webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /tmp/webapp.zip -d /opt/webapp

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
sudo chown -R csye6225:csye6225 /home/csye6225

# Step 6: Set ownership of /opt/webapp to csye6225
log_message "Setting ownership of /opt/webapp to csye6225..."
sudo chown -R csye6225:csye6225 /opt/webapp

# Step 7: Install Node.js dependencies
log_message "Installing Node.js dependencies..."
sudo -u csye6225 bash -c 'cd /opt/webapp && npm install'

# Step 8: Copy and enable the systemd service file
log_message "Copying systemd service file and enabling the service..."
if [ -f /tmp/webapp/my-app.service ]; then
    sudo cp /tmp/webapp/my-app.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable my-app.service
else
    log_message "Error: my-app.service file not found in /tmp"
    exit 1
fi

# Step 9: Start the application service
log_message "Starting the application service..."
sudo systemctl start my-app.service

# Verify the service status
log_message "Setup complete! Verifying service status..."
sudo systemctl status my-app.service --no-pager

# Log completion message
log_message "Web application setup complete!"

# Exit script successfully
exit 0