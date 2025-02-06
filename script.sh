#!/bin/bash

set -e

# Define a simple log function
log() {
    echo "[INFO] $1"
}

# Define a simple error handling function
handle_error() {
    echo "[ERROR] $1" >&2
    exit 1
}

sudo apt update -y
sudo apt upgrade -y
sudo apt install -y git curl postgresql postgresql-contrib nodejs npm unzip

sudo systemctl start postgresql 
sudo systemctl enable postgresql



# Load environment variables from .env
source .env

# Database operations - with better error messages
log "Creating database and user..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" || log "Note: No existing database to drop"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || handle_error "Couldn't create database"

# Create database user if it doesn't exist
sudo -u postgres psql -c "DO \$\$ BEGIN 
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN 
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF; 
END \$\$;"

# Update the user's password to ensure it matches the .env file
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

# Grant privileges on the database
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || handle_error "Couldn't grant privileges on database"

# Change the owner of the public schema to $DB_USER
sudo -u postgres psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;" || handle_error "Couldn't change owner of schema public"

# Grant privileges to the public schema and its objects
sudo -u postgres psql -d "$DB_NAME" -c "GRANT USAGE, CREATE ON SCHEMA public TO $DB_USER;" || handle_error "Couldn't grant schema privileges"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" || handle_error "Couldn't grant table privileges"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" || handle_error "Couldn't grant sequence privileges"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;" || handle_error "Couldn't grant function privileges"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" || handle_error "Couldn't set default privileges"



echo "Creating application user and group..."
sudo groupadd -f healthapp_group
sudo useradd -m -g healthapp_group -s /bin/bash healthapp_user

echo "Setting up application directory..."
unzip -o webapp.zip -d /opt/csye6225/ || handle_error "Couldn't unzip application"

# Copy the .env file into the application directory (assuming the unzipped folder is named 'webapp')
cp .env /opt/csye6225/webapp/ || handle_error "Couldn't copy .env file"


echo "Updating permissions..." 
sudo chown -R healthapp_user:healthapp_group "/opt/csye6225"
sudo chmod -R 755 "/opt/csye6225"

echo "Installing Node.js dependencies in /opt/csye6225/webapp..." 
cd "/opt/csye6225/webapp"
sudo npm install

echo "Application setup completed!"