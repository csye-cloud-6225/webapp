#!/bin/bash

set -e  # Exit on any error

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Step 1: Update packages and install dependencies
log_message "Step 1: Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip


# Step 2: Unzip webapp.zip to /opt/webapp
log_message "Unzipping webapp.zip to /opt/webapp..."
sudo mkdir -p /opt/webapp
sudo unzip -o /opt/webapp.zip -d /opt/webapp

# List contents to verify the extraction
log_message "Listing files in /opt/webapp..."
sudo ls -la /opt/webapp

# Step 3: Navigate to the webapp directory
cd /opt/webapp || exit 1

# Check if package.json exists
if [ ! -f package.json ]; then
    log_message "Error: package.json not found!"
    exit 1
fi

# Step 4: Create a local system user 'csye6225'
log_message "Creating local system user 'csye6225'..."
sudo useradd -r -s /usr/sbin/nologin csye6225

# Ensure csye6225 has the correct permissions for its home directory
sudo mkdir -p /home/csye6225
sudo chown csye6225:csye6225 /home/csye6225

# Step 5: Set ownership of /opt/webapp to csye6225
log_message "Setting ownership of /opt/webapp to csye6225..."
sudo chown -R csye6225:csye6225 /opt/webapp

# Step 6: Install Node.js dependencies
log_message "Installing Node.js dependencies..."
sudo -u csye6225 bash -c 'cd /opt/webapp && npm install'
sudo npm uninstall bcrypt
sudo npm install bcrypt

# Step 7: Copy and enable the systemd service file
sudo mv /opt/webapp/my-app.service /etc/systemd/system/my-app.service
sudo chown root:root /etc/systemd/system/my-app.service
sudo systemctl daemon-reload
sudo systemctl enable my-app.service
sudo systemctl start my-app.service || { log_message "Failed to start service"; exit 1; }
sudo systemctl status my-app.service
sudo journalctl -xeu my-app.service

# Create necessary directories if not present
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc

# Move the CloudWatch config file to the appropriate path
sudo mv /opt/webapp/config/amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

### Step 9: Verify CloudWatch Agent and Application Setup
log_message "Listing contents of /opt/webapp..."


# Log completion message
log_message "Web application setup complete!"

# Exit script successfully
exit 0
