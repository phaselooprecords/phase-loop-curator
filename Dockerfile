# Use an official Node.js runtime as a parent image
# Using Node 20 as specified in your package.json
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Install necessary system packages for sharp, including fontconfig
# RUN is used to execute commands during the image build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libvips \
    fontconfig \
    libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json first
# This leverages Docker cache - dependencies are only reinstalled if these files change
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy the rest of your application code into the container
COPY . .

# Make port 3000 available to the world outside this container (Railway uses env.PORT)
EXPOSE 3000

# Define the command to run your app
CMD ["npm", "start"]
