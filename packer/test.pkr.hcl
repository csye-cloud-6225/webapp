# AWS AMI Configuration
packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0, <2.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "db_password" {
  type    = string
  default = ""
}

variable "db_name" {
  type    = string
  default = ""
}
variable "db_user" {
  type    = string
  default = ""
}
variable "db_port" {
  type    = string
  default = ""
}
variable "db_host" {
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
  provisioner "shell" {
    inline = [
      "ls -la /tmp/webapp.zip",
      "file /tmp/webapp.zip",
      "echo 'Contents of /tmp:'",
      "ls -la /tmp"
    ]
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
    ]
  }

  provisioner "shell" {
    environment_vars = [
      "PASSWORD=${var.db_password}",
      "DB_NAME=${var.db_name}",
      "DB_HOST=${var.db_host}",
      "DB_USER=${var.db_user}",
      "DB_PORT=${var.db_port}"
    ]
    inline = [
      "echo 'Listing contents of /tmp before moving webapp.zip:'",
      "echo 'Moving webapp.zip to /opt/'",
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "echo 'Listing contents of /opt/'",
      "ls -la /opt/webapp.zip",
      "echo 'Unzipping webapp.zip to /opt/webapp'",
      "sudo unzip /opt/webapp.zip -d /opt/webapp",
      "echo 'Listing contents of /opt/webapp after unzipping:'",
      "ls -la /opt/webapp",
      "echo 'Making install_webapp.sh executable'",
      "sudo chmod +x /opt/webapp/install_webapp.sh",
      "echo 'Running install_webapp.sh'",
      "sudo /opt/webapp/install_webapp.sh",
      "echo 'Making install_webapp.sh executable'",
      "echo 'Running install_webapp.sh'"
    ]
  }
}