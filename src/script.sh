#!/bin/bash
set -ex

echo "Verifying file transfer..."
ls -al /tmp

if [ -f /tmp/webapp.zip ]; then 
  echo "✅ webapp.zip copied successfully!"
else 
  echo "❌ ERROR: webapp.zip NOT found in /tmp"
  exit 1
fi

if [ -f /tmp/application.service ]; then 
  echo "✅ application.service copied successfully!"
else 
  echo "❌ ERROR: application.service NOT found in /tmp"
  exit 1
fi

echo "File verification completed."
echo "Testing..."

cd /tmp/
ls -al

# Install necessary dependencies
sudo apt-get update -y
sudo apt-get install -y unzip curl postgresql postgresql-contrib

# Create a user and group for the application
echo "Creating user and group csye6225"
sudo groupadd csye6225 || echo "Group already exists"
sudo useradd -s /bin/false -g csye6225 -d /opt/csye6225 -m csye6225

# Install Node.js
echo " Installing Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g npm@latest

# Verify installations
node -v
npm -v

# Configure PostgreSQL
echo "Setting up PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "Creating PostgreSQL database and user..."
sudo -u postgres psql <<EOF
CREATE DATABASE $db_name;
ALTER USER $db_user WITH ENCRYPTED PASSWORD '$db_password';
GRANT ALL PRIVILEGES ON DATABASE $db_name TO $db_user;
EOF

# Move application service file
echo "Moving application service file..."
sudo mv /tmp/application.service /etc/systemd/system/application.service
sudo chmod 644 /etc/systemd/system/application.service

# Set up application directory
echo "Creating /opt/csye6225 directory..."
sudo mkdir -p /opt/csye6225
sudo chown csye6225:csye6225 /opt/csye6225
sudo chmod 755 /opt/csye6225

# Move and unzip web application
echo "Moving webapp.zip..."
if [ -f /tmp/webapp.zip ]; then 
  sudo mv /tmp/webapp.zip /opt/csye6225/
  echo "webapp.zip moved successfully!"
else 
  echo "Error: /tmp/webapp.zip not found"
  ls -l /tmp/
  exit 1
fi

echo "Unzipping webapp.zip..."
cd /opt/csye6225
sudo unzip webapp.zip
ls -al

echo "Setting ownership and permissions..."
sudo chown -R csye6225:csye6225 /opt/csye6225
sudo chmod -R 755 /opt/csye6225

# Install application dependencies
echo "Running npm install..."
sudo npm install

# Start application service
echo "Starting application service..."
sudo systemctl daemon-reload
sudo systemctl enable application
sudo systemctl start application

echo "Script execution completed successfully!"
