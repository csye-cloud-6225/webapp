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
sudo npm uninstall bcrypt
sudo npm install bcrypt

# Step 2: Configure MySQL server
log_message "Configuring MySQL server..."

# Enable and start MySQL service
log_message "Starting MySQL service..."
sudo systemctl enable mysql
sudo systemctl start mysql


sudo mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Parna.coM001';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS health_check;
EOF



log_message "MySQL security configuration completed."

log_message "Contents of /tmp before unzipping:"
ls -la /tmp
log_message "File details of webapp.zip:"
file /tmp/webapp.zip || echo "webapp.zip not found"
log_message "Attempting to unzip /tmp/webapp.zip..."

# Step 3: Unzip webapp.zip to /opt/webapp
log_message "Unzipping webapp.zip to /opt/webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /opt/webapp.zip -d /opt/webapp

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
if [ -f /opt/webapp/my-app.service ]; then
    sudo mv /opt/webapp/my-app.service /etc/systemd/system/my-app.service
    sudo chown root:root /etc/systemd/system/my-app.service
    if [ $? -ne 0 ]; then
        log_message "Error moving service file"
        exit 1
    fi
    sudo chmod 644 /etc/systemd/system/my-app.service
    sudo systemctl daemon-reload
    if ! sudo systemctl enable my-app.service; then
        log_message "Error enabling service"
        sudo systemctl status my-app.service
        exit 1
    fi
    if ! sudo systemctl start my-app.service; then
        log_message "Error starting service"
        sudo systemctl status my-app.service
        exit 1
    fi
    sudo systemctl status my-app.service
else
    log_message "Error: my-app.service file not found in /opt/webapp"
    exit 1
fi
sudo journalctl -u /etc/systemd/system/my-app.service
# Set environment variables securely
# Create the directory if it doesn't exist
sudo mkdir -p /etc/systemd/system/my-app.service.d

# Now proceed to create the override.conf file
sudo tee /etc/systemd/system/my-app.service.d/override.conf <<EOT
[Service]
Environment="DB_HOST=${DB_HOST}"
Environment="DB_USER=${DB_USER}"
Environment="DB_PASSWORD=${DB_PASSWORD}"
Environment="DB_NAME=${DB_NAME}"
Environment="DB_PORT=${DB_PORT}"
EOT


echo "Contents of .env file:"
cat /opt/webapp/.env

# List contents of /opt/webapp--------
log_message "Contents of /opt/webapp:"
ls -la /opt/webapp

# Log completion message
log_message "Web application setup complete!"

# Exit script successfully
exit 0