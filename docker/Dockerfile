FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Copy the source code
COPY ./ /usr/src/app/

# Install app dependencies
RUN npm install --production

CMD ["npm", "start"]
