# Packer Configuration
packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0, <2.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

# Variables for build configuration
variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "source_ami" {
  type    = string
  default = "ami-0cad6ee50670e3d0e"
}

variable "ssh_username" {
  type    = string
  default = "ubuntu"
}

variable "subnet_id" {
  type    = string
  default = "subnet-01559dcd81713aec8"
}

# AWS AMI source configuration
source "amazon-ebs" "my-ami" {
  region          = var.aws_region
  profile         = "dev_role"
  ami_name        = "MyAMI_Image-{{timestamp}}"
  ami_description = "AMI for CSYE 6225"

  tags = {
    Name        = "CSYE6225_Custom_AMI"
    Environment = "dev"
  }

  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 25
    volume_type           = "gp2"
    delete_on_termination = true
  }

  instance_type = "t2.small"
  source_ami    = var.source_ami
  ssh_username  = var.ssh_username
  subnet_id     = var.subnet_id
}

# Build block with provisioners for setup
build {
  sources = ["source.amazon-ebs.my-ami"]

  # Copy the webapp.zip from local to /tmp on the instance
  provisioner "file" {
    source      = "C:/Users/hp/Desktop/Packer/webapp/webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  # Copy the systemd service file from local to /tmp
  provisioner "file" {
    source      = "C:/Users/hp/Desktop/Packer/webapp/my-app.service"
    destination = "/tmp/my-app.service"
  }

  # Shell provisioner for setting up the instance
  provisioner "shell" {
    inline = [
      "export DEBIAN_FRONTEND=noninteractive",
      "sudo apt-get update && sudo apt-get install -y nodejs npm mysql-server unzip",

      # Unzip the webapp and move it to /opt
      "sudo unzip /tmp/webapp.zip -d /opt/webapp",

      # Create a new system user 'csye6225' without login access
      "sudo useradd -r -s /usr/sbin/nologin csye6225",

      # Set ownership of the webapp files to 'csye6225'
      "sudo chown -R csye6225:csye6225 /opt/webapp",

      # Secure MySQL installation
      "echo 'n\nY\nY\nY\nY\nY' | sudo mysql_secure_installation",

      # Ensure MySQL is running and enabled on startup
      "sudo systemctl enable mysql",
      "sudo systemctl start mysql",

      # Set root password and configure mysql_native_password plugin
      "sudo mysql -u root -e \"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Parna.coM001';\"",

      # Flush privileges to apply changes
      "sudo mysql -u root -pParna.coM001 -e \"FLUSH PRIVILEGES;\"",

      # Create the 'health_check' database
      "sudo mysql -u root -pParna.coM001 -e \"CREATE DATABASE health_check;\"",

      # Verify MySQL user configuration
      "sudo mysql -u root -pParna.coM001 -e \"SELECT user, host, plugin FROM mysql.user WHERE user = 'root';\"",

      # Copy the service file to systemd and enable the service
      "sudo cp /tmp/my-app.service /etc/systemd/system/",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable my-app.service"
    ]
  }

  # Post-processor to generate a manifest of the build
  post-processor "manifest" {
    output = "manifest.json"
  }
}
