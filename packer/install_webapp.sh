#!/bin/bash

set -e  # Exit on any error

# Step 1: Update packages and install dependencies
echo "Step 1: Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip mysql-server

# Step 2: Configure MySQL server
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

# Set up MySQL database and user
echo "Setting up MySQL database..."
sudo mysql -u root -p${secrets.Password} <<EOF
CREATE DATABASE ${secrets.DB_Name};
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${secrets.Password}';
FLUSH PRIVILEGES;
EOF

echo "MySQL security configuration completed."
# Step 1: Create the packer-template directory if it doesn't exist
mkdir -p packer-template
# Step 3: Zip the webapp folder if it exists
echo "Checking for webapp folder and creating zip..."
if [ -d "../webapp" ]; then
    zip -r /tmp/webapp.zip ../webapp
    echo "Webapp folder zipped successfully."
else
    echo "Error: Webapp folder not found in the expected location!"
    exit 1
fi

# Step 4: Unzip webapp.zip to /opt/webapp
echo "Unzipping webapp.zip to /opt/webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /tmp/webapp.zip -d /opt/webapp

# List contents to verify the extraction
echo "Listing files in /opt/webapp..."
sudo ls -la /opt/webapp

# Step 5: Navigate to the webapp directory
cd /opt/webapp/webapp || exit 1

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "Error: package.json not found!"
    exit 1
fi

# Step 6: Create a local system user 'csye6225'
echo "Creating local system user 'csye6225'..."
sudo useradd -r -s /usr/sbin/nologin csye6225

# Step 7: Set ownership of /opt/webapp to csye6225
echo "Setting ownership of /opt/webapp to csye6225..."
sudo chown -R csye6225:csye6225 /opt/webapp

# Step 8: Install Node.js dependencies
echo "Installing Node.js dependencies..."
sudo npm install

# Step 9: Copy and enable the systemd service file
echo "Copying systemd service file and enabling the service..."
sudo cp /tmp/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service

# Step 10: Start the application service
echo "Starting the application service..."
sudo systemctl start my-app.service

# Verify the service status
echo "Setup complete! Verifying service status..."
sudo systemctl status my-app.service --no-pager

# Log completion message
echo "Web application setup complete!"

# Exit script successfully
exit 0
