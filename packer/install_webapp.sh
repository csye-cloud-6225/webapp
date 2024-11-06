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

# Set up logs directory and app.log with appropriate ownership and permissions
sudo mkdir -p /opt/webapp/logs
sudo touch /opt/webapp/logs/app.log
sudo chown csye6225:csye6225 /opt/webapp/logs/app.log
sudo chmod 664 /opt/webapp/logs/app.log  # Read-write for owner and group

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

# Install CloudWatch Agent
echo "Installing CloudWatch Agent..."
curl -s https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Create CloudWatch Agent config directory if it does not exist
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc

# Configure CloudWatch Agent
echo "Configuring CloudWatch Agent..."
cat <<EOF | sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "append_dimensions": {
      "InstanceId": "\$${aws:InstanceId}"
    },
    "aggregation_dimensions": [["InstanceId"]],
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      },
      "cpu": {
        "measurement": ["cpu_usage_active"],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "/aws/ec2/syslog",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%b %d %H:%M:%S"
          },
          {
            "file_path": "/opt/webapp/logs/app.log",
            "log_group_name": "/aws/ec2/app-logs",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          }
        ]
      }
    }
  }
}
EOF
# Verify JSON configuration file creation
if [ -f "/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json" ]; then
    echo "CloudWatch Agent JSON configuration file created successfully."
else
    echo "Failed to create CloudWatch Agent JSON configuration file." >&2
    exit 1
fi
# Display configuration contents
log_message "Displaying CloudWatch Agent configuration file..."
sudo cat /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Lock down permissions on the JSON file and make it immutable to prevent deletion
# Unlock the JSON file if modification or removal is needed
sudo chattr -i /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo chmod 644 /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo chattr +i /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
log_message "Locked CloudWatch Agent JSON configuration file permissions."

# Start CloudWatch Agent
echo "Starting CloudWatch Agent..."
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Verify CloudWatch Agent status
sudo systemctl status amazon-cloudwatch-agent || exit 1
# Check if the file still exists after starting the agent
if [ -f "/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json" ]; then
    echo "CloudWatch Agent JSON configuration file is still present after starting the agent."
else
    echo "CloudWatch Agent JSON configuration file is missing after starting the agent." >&2
    exit 1
fi
# Verify CloudWatch Agent status and check logs for any immediate issues
sudo systemctl status amazon-cloudwatch-agent || exit 1
if [ -f "/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log" ]; then
    log_message "Displaying recent CloudWatch Agent logs..."
    sudo tail -n 20 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log  # Display last 20 lines of the log for troubleshooting
fi
# Install and Configure StatsD
echo "Installing StatsD and CloudWatch backend for StatsD..."
sudo npm install -g statsd statsd-cloudwatch-backend

# Create StatsD configuration directory if it doesn't exist
sudo mkdir -p /etc/statsd

# Create a StatsD configuration file with CloudWatch backend
cat <<EOF | sudo tee /etc/statsd/config.js
{
  port: 8125,
  backends: ["statsd-cloudwatch-backend"],
  cloudwatch: {
    namespace: "WebAppMetrics",
    region: process.env.AWS_REGION || "us-east-1"
  }
}
EOF

# Configure StatsD as a systemd service
echo "Configuring StatsD as a systemd service..."
cat <<EOF | sudo tee /etc/systemd/system/statsd.service
[Unit]
Description=StatsD Service
After=network.target

[Service]
ExecStart=/usr/local/bin/statsd /etc/statsd/config.js
Restart=on-failure
StandardOutput=syslog
StandardError=syslog

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd, enable, and start the StatsD service
sudo systemctl daemon-reload
sudo systemctl enable statsd
sudo systemctl start statsd

# Verify StatsD service status
sudo systemctl status statsd || exit 1

log_message "Installation completed!"


### Step 9: Verify CloudWatch Agent and Application Setup
log_message "Listing contents of /opt/webapp..."
# Final check before ending script
log_message "Final check for CloudWatch Agent JSON configuration file presence..."
if [ -f "/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json" ]; then
    echo "CloudWatch Agent JSON configuration file is present at the end of the script."
else
    echo "CloudWatch Agent JSON configuration file went missing at the end of the script." >&2
    exit 1
fi

# Log completion message
log_message "Web application setup complete!"

# Exit script successfully
exit 0