#!/bin/bash
set -e

npm run destroy
git checkout main
npm i
npm run configure-storage 
npx ts-node-esm ./src/setup/bootstrap.ts
git checkout engine
npm i
npm run migrate