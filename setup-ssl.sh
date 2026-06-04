#!/bin/bash

# ==============================================================================
# EaseVote SSL Certificate Setup Script (HTTP Challenge)
# ==============================================================================

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run this script with sudo or as root."
  exit 1
fi

DOMAIN="api.easevotegh.com"
EMAIL="admin@easevotegh.com" # CHANGE THIS to your actual email address

echo "Installing Certbot..."
apt-get update
apt-get install -y certbot

echo "Stopping existing Docker containers..."
# Stop the containers fully so port 80 is freed up
docker compose down || true

echo "Requesting SSL Certificate for $DOMAIN..."
certbot certonly \
  --standalone \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

if [ $? -eq 0 ]; then
  echo "Certificate generated successfully."
  echo "Applying SSL configurations..."
  
  # Automatically replace the current configurations with the SSL-enabled versions
  cp docker-compose.ssl.yml docker-compose.yml
  cp nginx/nginx.ssl.conf nginx/nginx.conf
  
  echo "Starting containers with SSL enabled..."
  docker compose up -d
  
  echo "=============================================================================="
  echo "All done! Your API is now securely running on https://$DOMAIN"
  echo "=============================================================================="
else
  echo "Certbot encountered an error. Configurations were NOT changed."
  echo "Restarting application in non-SSL mode..."
  docker compose up -d
fi
