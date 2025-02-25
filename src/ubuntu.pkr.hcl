packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

# Define variables
variable "db_name" {
  type    = string
  default = "health_check"
}

variable "db_user" {
  type    = string
  default = "postgres"
}

variable "ami_users" {
  type    = string
  default = "dev"
}

variable "db_password" {
  type    = string
  default = "Pragati@1109"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "source_ami" {
  type    = string
  default = "ami-05b10e08d247fb927" # Default Ubuntu AMI, can be replaced with your preferred one
}

variable "ssh_username" {
  type    = string
  default = "ubuntu"
}

variable "subnet_id" {
  type    = string
  default = "subnet-03fcf1317b2bdd443" # Example subnet, replace with your subnet
}

variable "aws_access_key" {
  type = string
}

variable "aws_secret_key" {
  type = string
}

locals {
  sanitized_timestamp = replace(timestamp(), ":", "-") # Replace colons with dashes to make it valid
}

source "amazon-ebs" "ubuntu" {
  region          = var.aws_region
  ami_name        = "csye6225-custom-webapp-${local.sanitized_timestamp}"
  ami_description = "AMI for CSYE 6225 - Custom Web App"

  ami_regions = [
    "us-east-1"
  ]

  access_key = var.aws_access_key # Reference the access key variable
  secret_key = var.aws_secret_key # Reference the secret key variable

  aws_polling {
    delay_seconds = 120
    max_attempts  = 50
  }

  instance_type = "t2.micro"
  source_ami    = var.source_ami
  ssh_username  = var.ssh_username
  subnet_id     = var.subnet_id

  launch_block_device_mappings {
    delete_on_termination = true
    device_name           = "/dev/sda1"
    volume_size           = 8
    volume_type           = "gp2"
  }
}

build {
  sources = [
    "source.amazon-ebs.ubuntu"
  ]

  provisioner "file" {
    source      = "webapp.zip" # Copy the entire webapp codebase
    destination = "/tmp/webapp.zip"
  }

  provisioner "file" {
    source      = "application.service" # Copy the entire webapp codebase
    destination = "/tmp/application.service"
  }

  provisioner "file" {
    source      = "script.sh"  # Ensure this is in the correct location
    destination = "/tmp/script.sh"
  }

  provisioner "shell" {
    script = "/tmp/script.sh"
    execute_command = "sudo -E /bin/bash {{ .Path }}"
    environment_vars = [
      "db_user=${var.db_user}",
      "db_password=${var.db_password}",
      "db_name=${var.db_name}"
    ]
  }
}