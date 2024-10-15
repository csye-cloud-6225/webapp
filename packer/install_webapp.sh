#!/bin/bash

set -e  # Exit on any error

echo "Step 1: Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip mysql-server

echo "Step 2: Configuring MySQL server..."
# Set up MySQL for the first time
echo "Configuring MySQL server..."
sudo mysql_secure_installation <<EOF
n
y
y
y
y
EOF

# Enable and start MySQL service
echo "Starting MySQL service..."
sudo systemctl enable mysql
sudo systemctl start mysql

# Log in to MySQL and set up the database
echo "Setting up MySQL database..."

sudo mysql -u root -p${secrets.Password} <<EOF
CREATE DATABASE ${secrets.DB_NAME};
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${secrets.Password}';
FLUSH PRIVILEGES;
EOF

# Secure MySQL installation
# sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Parna.coM001';"
# Function to run mysql_secure_installation
echo "MySQL security configuration completed."



# Ensure the /opt/webapp directory exists
echo "Unzipping webapp.zip to /opt/webapp..."
sudo mkdir -p /opt/webapp
if [ -f /tmp/webapp.zip ]; then
    sudo unzip /tmp/webapp.zip -d /opt/webapp
else
    echo "Error: webapp.zip not found in /tmp!"
    exit 1
fi

# List contents to verify
echo "Listing files in /opt/webapp..."
sudo ls -la /opt/webapp

# Navigate to the webapp directory
cd /opt/webapp/webapp || exit

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "Error: package.json not found!"
    exit 1
fi

echo "Step 5: Creating local system user 'csye6225'..."
sudo useradd -r -s /usr/sbin/nologin csye6225

echo "Step 6: Setting ownership of /opt/webapp to csye6225..."
sudo chown -R csye6225:csye6225 /opt/webapp

echo "Step 7: Installing Node.js dependencies..."
sudo npm install

# Copy the systemd service file and enable the service
echo "Step 8: Copying systemd service file and enabling service..."
sudo cp /tmp/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service

echo "Step 9: Starting the application service..."
sudo systemctl start my-app.service

echo "Setup complete! Verifying service status..."
sudo systemctl status my-app.service --no-pager

# Logging complete
echo "Web application setup complete!"

# Exit script successfully
exit 0