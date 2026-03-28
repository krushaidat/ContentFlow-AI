# ContentFlow AI - Test Files Setup Guide

## Backend Setup (server/)

### 1. Install Jest

cd server
npm install --save-dev jest

### 2. Add test script to server/package.json

Open `server/package.json` and add or update the "scripts" section:

{
  "scripts": {
    "start": "node index.js",
    "test": "jest --verbose --forceExit --detectOpenHandles"
  }
}

### 3. Run backend tests

cd server
npm test

This will run all `*.test.js` files in the `server/test/` folder.

## Frontend Setup (client/)

### 1. Install testing dependencies

cd client
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

### 2. Update client/vite.config.js

Add the `test` configuration to your existing vite.config.js:

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: false,
  },
})

### 3. Add test script to client/package.json

Open `client/package.json` and add:

{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run --reporter=verbose",
    "test:watch": "vitest"
  }
}

### 4. Copy setupTests.js

Copy the `setupTests.js` file to `client/src/setupTests.js`.

### 5. Run frontend tests

cd client
npm test

This will run all `*.test.js` and `*.test.jsx` files in `client/src/__tests__/`.
