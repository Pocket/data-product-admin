# Strapi application

A quick description of your strapi application

## Deploy

Create Setup Docker Repository
```shell
cdk deploy DataProductAdminRepository
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 410318598490.dkr.ecr.us-east-1.amazonaws.com
docker build -t data-product-admin .
docker tag data-product-admin:latest 410318598490.dkr.ecr.us-east-1.amazonaws.com/data-product-admin:latest
docker push
```
