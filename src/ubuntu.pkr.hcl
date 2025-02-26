packer {
  required_plugins {
    amazon = {
      version = ">= 1.2.8"
      source  = "github.com/hashicorp/amazon"
    }
    # # GCP
    # googlecompute = {
    #   version = ">= 1.0.0"
    #   source  = "github.com/hashicorp/googlecompute"
    # }
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


# GCP Variables
variable "project_id" {
  type    = string
  default = "csye-6225-452005"
}


variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
}


locals {
  sanitized_timestamp = replace(timestamp(), ":", "-") # Replace colons with dashes to make it valid
}

# GCP Builder Configuration
source "googlecompute" "gcp-image" {
  project_id          = var.project_id
  source_image_family = "ubuntu-2204-lts"
  image_name          = "csye6225-gcp-webapp"
  machine_type        = "e2-medium"
  zone                = var.gcp_zone
  ssh_username        = "ubuntu"
  image_family        = "custom-images"
  image_description   = "Custom Image for CSYE 6225 on GCP"
}


# Amazon AMI Builder
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
    "source.amazon-ebs.ubuntu",
    "source.googlecompute.gcp-image"
  ]

  provisioner "file" {
    source      = "webapp.zip" # Copy the entire webapp codebase
    destination = "/tmp/webapp.zip"
  }
  provisioner "file" {
    source      = "application.service" # Copy the entire webapp codebase
    destination = "/tmp/application.service"
  }

  provisioner "shell" {
    inline = [
      "echo 'Verifying file transfer...'",

      "echo 'Listing /tmp directory after file provisioner:'",

      "if [ -f /tmp/webapp.zip ]; then echo 'webapp.zip copied successfully!'; else echo 'ERROR: webapp.zip NOT found in /tmp'; exit 1; fi",

      "if [ -f /tmp/application.service ]; then echo 'application.service copied successfully!'; else echo 'ERROR: application.service NOT found in /tmp'; exit 1; fi",

      "echo 'File verification completed.'",

      "set -ex",
      "cd /tmp/",
      "ls -al",

      "sudo apt-get update -y",
      "sudo apt-get upgrade -y",
      "sudo apt-get install -y unzip",

      "echo 'Creating user and group csye6225'",
      "sudo groupadd csye6225 || echo 'Group already exists'",
      "sudo useradd -s /bin/false -g csye6225 -d /opt/csye6225 -m csye6225",

      # Install Node.js .x
      "echo 'Installing Node.js v20...'",
      "sudo apt-get install -y curl",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt-get install -y nodejs",
      "sudo npm install -g npm@latest",

      "node -v",
      "npm -v",

      # Install PostgreSQL
      "sudo apt-get install -y postgresql postgresql-contrib unzip",
      "sudo systemctl enable postgresql",
      "sudo systemctl start postgresql",

      # Create PostgreSQL database and user with privileges
      "sudo -u postgres psql -c \"CREATE DATABASE ${var.db_name};\"",
      "sudo -u postgres psql -c \"ALTER USER ${var.db_user} WITH ENCRYPTED PASSWORD '${var.db_password}';\"",
      "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${var.db_name} TO ${var.db_user};\"",

      "echo 'Move application started'",
      "sudo mv /tmp/application.service /etc/systemd/system",
      "sudo chmod 644 /etc/systemd/system/application.service",
      "echo 'Move application completed'",

      # Create /opt/csye6225 directory and set permissions
      "echo 'Creating /opt/csye6225 directory'",
      "sudo mkdir -p /opt/csye6225",
      "sudo chown csye6225:csye6225 /opt/csye6225",
      "sudo chmod 755 /opt/csye6225",
      "echo 'Switching to csye6225 user and moving webapp.zip'",
      "if [ -f /tmp/webapp.zip ]; then sudo mv /tmp/webapp.zip /opt/csye6225/ && echo 'webapp.zip moved to /opt/csye6225/'; else echo 'Error: /tmp/webapp.zip not found' && ls -l /tmp/ && exit 1; fi",

      "sudo chown -R csye6225:csye6225 /opt/csye6225",
      "sudo chmod 755 /opt/csye6225/webapp.zip",

      "echo 'Unzipping webapp.zip as csye6225'",
      "sudo chown -R csye6225:csye6225 /opt/csye6225",
      "sudo chmod -R 755 /opt/csye6225",
      "cd /opt/csye6225",

      "sudo unzip webapp.zip",

      "echo 'Finished unzip operation'",

      "echo 'Setting ownership of files after unzipping'",
      "sudo chown -R csye6225:csye6225 /opt/csye6225",
      "sudo chmod -R 755 /opt/csye6225",

      # Run npm install as csye6225
      "echo 'Running npm install as csye6225'",
      "sudo npm install",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable application",
      "sudo systemctl start application",


      "echo 'Script execution completed successfully!'",

    ]
  }


}