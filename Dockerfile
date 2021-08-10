# syntax=docker/dockerfile:1
FROM strapi/base
# RUN apk update

# RUN apk add --no-cache python g++ make
WORKDIR /srv/app
ENV NODE_ENV=production
COPY . .
RUN npm install
CMD ["npm", "start"]
