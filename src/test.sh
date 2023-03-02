#!/bin/bash
set -e

git checkout main
npm ci
npm run bootstrap
git checkout engine
npm ci
npm run bootstrap