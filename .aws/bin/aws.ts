#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AdminStack } from '../lib/admin-stack';
import { PipelineStack } from '../lib/pipeline-stack';
import {RepositoryStack} from "../lib/repository-stack";

const app = new cdk.App();
const props = {
  env: {
    region: 'us-east-1',
    account: '410318598490',
  },
  tags: {
    service: 'DataProductDocs'
  }
}

// const repositoryStack = new RepositoryStack(app, 'DataProductAdminRepository', props)
// const adminStack = new AdminStack(app, 'DataProductAdmin', {
//   ...props,
//   repository: repositoryStack.repository,
// })
// const pipelineStack = new PipelineStack(app, 'DataProductAdminPipeline', {
//   ...props,
//   repository: repositoryStack.repository,
//   service: adminStack.service.service,
// })

// const pipelineStack = new PipelineStack(app, 'DataProductDocsPipelineStack', {...props, bucket: docStack.bucket});
