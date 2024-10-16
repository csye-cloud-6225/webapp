# AWS AMI Configuration
packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0, <2.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "Password" {
  type    = string
  default = ""
}

variable "DB_NAME" {
  type    = string
  default = ""
}
variable "USER" {
  type    = string
  default = ""
}
variable "PORT" {
  type    = string
  default = ""
}

variable "DB_HOST" {
  type    = string
  default = ""
}

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

source "amazon-ebs" "my-ami" {
  region          = var.aws_region
  profile         = "dev_role"
  ami_name        = "MyAMI_Image-{{timestamp}}"
  ami_description = "AMI for CSYE 6225"

  tags = {
    Name        = "test-CSYE6225_Custom_AMI"
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

build {
  sources = ["source.amazon-ebs.my-ami"]

  provisioner "file" {
    source      = "../webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  provisioner "file" {
    source      = "${path.root}/my-app.service"
    destination = "/tmp/my-app.service"
  }

  provisioner "file" {
    source      = "${path.root}/install_webapp.sh"
    destination = "/tmp/install_webapp.sh"
  }

  provisioner "shell" {
    inline = [
      "echo 'Listing contents of /tmp:'",
      "ls -la /tmp",
      "echo 'Moving my-app.service to /etc/systemd/system/'",
      "sudo mv /tmp/my-app.service /etc/systemd/system/",
      "sudo chown root:root /etc/systemd/system/my-app.service",
      "sudo chmod 644 /etc/systemd/system/my-app.service",
      "echo 'Listing contents of /etc/systemd/system/'",
      "ls -la /etc/systemd/system/my-app.service"
    ]
  }

  provisioner "shell" {
    environment_vars = [
      "DB_PASSWORD=${var.Password}",
      "DB_NAME=${var.DB_NAME}",
      "DB_HOST=${var.DB_HOST}",
      "DB_USER=${var.USER}",
      "DB_PORT=${var.PORT}"
    ]
    inline = [
      "echo 'Listing contents of /tmp before moving webapp.zip:'",
      "ls -la /tmp",
      "echo 'Moving webapp.zip to /opt/'",
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "sudo chmod 644 /opt/webapp.zip",
      "echo 'Listing contents of /opt/'",
      "ls -la /opt/webapp.zip",
      "echo 'Making install_webapp.sh executable'",
      "chmod +x /tmp/install_webapp.sh",
      "echo 'Running install_webapp.sh'",
      "sudo -E /tmp/install_webapp.sh",
      "echo 'Adding environment variables to /etc/environment'",
      "echo 'DB_HOST=${var.DB_HOST}' | sudo tee -a /etc/environment",
      "echo 'DB_USER=${var.USER}' | sudo tee -a /etc/environment",
      "echo 'DB_PASSWORD=${var.Password}' | sudo tee -a /etc/environment",
      "echo 'DB_NAME=${var.DB_NAME}' | sudo tee -a /etc/environment",
      "echo 'DB_PORT=${var.PORT}' | sudo tee -a /etc/environment",
      "echo 'Contents of /etc/environment:'",
      "cat /etc/environment"
    ]
  }
}