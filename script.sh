#!/bin/bash

# Prompt user for PostgreSQL password
read -s -p "Enter the password for PostgreSQL user (postgres): " POSTGRES_PASSWORD
echo ""

APP_DIR="/opt/csye6225"
WEBAPP_DIR="/opt/csye6225/webapp"
ZIP_FILE="/root/webapp.zip"
ENV_FILE="/root/.env"

sudo apt update -y
sudo apt upgrade -y
sudo apt install -y git curl postgresql postgresql-contrib nodejs npm unzip

sudo systemctl start postgresql 
sudo systemctl enable postgresql

echo "Creating PostgreSQL database and user..." 
sudo -i -u postgres psql <<EOF 
CREATE DATABASE healthcheck_db; 
ALTER USER postgres WITH PASSWORD '$POSTGRES_PASSWORD';
EOF

echo "Creating application user and group..."
sudo groupadd -f healthapp_group
sudo useradd -m -g healthapp_group -s /bin/bash healthapp_user

echo "Setting up application directory..."
sudo rm -rf $APP_DIR
sudo mkdir -p $APP_DIR
sudo unzip -o $ZIP_FILE -d $APP_DIR

echo "Moving .env file to the application directory..." 
sudo mv $ENV_FILE $WEBAPP_DIR/

echo "Updating permissions..." 
sudo chown -R healthapp_user:healthapp_group $APP_DIR 
sudo chmod -R 750 $APP_DIR

echo "Installing Node.js dependencies in /opt/csye6225/webapp..." 
cd $WEBAPP_DIR 
sudo npm install

echo "Application setup completed!"
