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

  provisioner "shell" {
    inline = [
      "echo '🔹 Ensuring persistent directory for webapp...'",
      "sudo mkdir -p /opt/csye6225/webapp",
      "sudo chown -R csye6225:csye6225 /opt/csye6225",
      "sudo chmod -R 755 /opt/csye6225",

      "echo '🔹 Moving application.service...'",
      "if [ -f /tmp/application.service ]; then sudo mv /tmp/application.service /etc/systemd/system/application.service && sudo chmod 644 /etc/systemd/system/application.service; else echo '❌ ERROR: application.service NOT found!' && exit 1; fi",

      "echo '🔹 Moving webapp.zip...'",
      "if [ -f /tmp/webapp.zip ]; then sudo mv /tmp/webapp.zip /opt/csye6225/webapp.zip; else echo '❌ ERROR: webapp.zip NOT found!' && exit 1; fi",

      "echo '🔹 Extracting webapp.zip...'",
      "sudo unzip /opt/csye6225/webapp.zip -d /opt/csye6225/webapp",
      "sudo chown -R csye6225:csye6225 /opt/csye6225/webapp",
      "sudo chmod -R 755 /opt/csye6225/webapp",
      "ls -al /opt/csye6225/webapp",

      "echo '🔹 Flushing file system buffers...'",
      "sync",

      "echo '🔹 Installing Node.js v20...'",
      "sudo apt-get install -y curl",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt-get install -y nodejs",
      "sudo npm install -g npm@latest",
      "node -v", # Verify Node.js installation
      "npm -v",  # Verify npm installation

      "echo '🔹 Installing PostgreSQL...'",
      "sudo apt-get install -y postgresql postgresql-contrib unzip",
      "sudo systemctl enable postgresql",
      "sudo systemctl start postgresql",

      "echo '🔹 Setting up PostgreSQL Database...'",
      "sudo -u postgres psql -c \"CREATE DATABASE ${var.db_name};\"",
      "sudo -u postgres psql -c \"ALTER USER ${var.db_user} WITH ENCRYPTED PASSWORD '${var.db_password}';\"",
      "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${var.db_name} TO ${var.db_user};\"",

      "echo '🔹 Enabling application service...'",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable application",

      "echo '🔹 Final File Check Before AMI Capture...'",
      "ls -al /opt/csye6225",
      "ls -al /etc/systemd/system/application.service",
    ]
  }
}
