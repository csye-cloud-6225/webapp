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
variable "DB_PORT" {
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
    source      = "${path.root}/webapp.zip"
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
      "ls -la /tmp", // Add this line to check the contents of /tmp
      "sudo mv /tmp/my-app.service /etc/systemd/system/",
      "sudo chown root:root /etc/systemd/system/my-app.service",
      "sudo chmod 644 /etc/systemd/system/my-app.service"
    ]
  }

  provisioner "shell" {
    environment_vars = [
      "DB_PASSWORD=${var.Password}",
      "DB_NAME=${var.DB_NAME}"
    ]
    inline = [
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "sudo chmod 644 /opt/webapp.zip",
      "sudo mv /tmp/my-app.service /opt/my-app.service",
      "sudo chmod 644 /opt/my-app.service",
      "chmod +x /tmp/install_webapp.sh",
      "sudo /tmp/install_webapp.sh",
      "echo 'DB_HOST=${var.DB_HOST}' | sudo tee -a /etc/environment",
      "echo 'DB_USER=${var.USER}' | sudo tee -a /etc/environment",
      "echo 'DB_PASSWORD=${var.Password}' | sudo tee -a /etc/environment",
      "echo 'DB_NAME=${var.DB_NAME}' | sudo tee -a /etc/environment",
      "echo 'DB_PORT=${var.DB_PORT}' | sudo tee -a /etc/environment",
    ]
  }
}