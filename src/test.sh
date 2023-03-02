#!/bin/bash
set -e

git checkout main
npm ci
npx ts-node-esm ./src/setup/bootstrap.ts
git checkout engine
npm ci
npx ts-node-esm ./src/setup/bootstrap.ts