# ContentFlow AI

> An AI-powered content management and generation platform built with React, Node.js, Firebase, and Google APIs.

## Overview

ContentFlow AI is a full-stack web application designed to streamline content creation and management. The platform leverages modern AI capabilities through Google APIs to help users generate, organize, and manage content efficiently. Built with a React frontend and Node.js backend, it integrates Firebase for authentication and data persistence.

## 🚀 Features

- **AI-Powered Content Generation** - Generate and enhance content using Google's AI APIs
- **Real-time Collaboration** - Seamless content editing and sharing
- **Firebase Authentication** - Secure user authentication and management
- **Responsive UI** - Modern React-based user interface
- **RESTful API** - Robust Node.js backend with comprehensive API endpoints
- **Testing Suite** - Full test coverage with Vitest (frontend) and Jest (backend)

## 📁 Project Structure

```
ContentFlow-AI/
├── client/                 # React frontend application
│   ├── src/               # React components and pages
│   ├── public/            # Static assets
│   ├── package.json       # Frontend dependencies
│   └── vite.config.js     # Vite configuration
├── server/                # Node.js backend application
│   ├── routes/            # API route handlers
│   ├── models/            # Data models
│   ├── controllers/       # Business logic
│   ├── package.json       # Backend dependencies
│   └── index.js           # Server entry point
└── package-lock.json      # Dependency lock file
```

## 🛠️ Tech Stack

### Frontend
- **React** ^19.2.0 - UI library
- **React Router DOM** ^7.13.0 - Client-side routing
- **Vite** ^7.3.2 - Build tool and dev server
- **Firebase** ^12.9.0 - Authentication and real-time database
- **Google APIs** ^171.4.0 - AI and content services

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework (implied by structure)
- **Firebase** - Authentication and database

### Testing
- **Vitest** ^3.2.4 - Frontend testing framework
- **Jest** - Backend testing framework
- **Testing Library** - Component testing utilities

## 📦 Installation

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### Setup Instructions

#### 1. Clone the repository
```bash
git clone https://github.com/CyTanvir/ContentFlow-AI.git
cd ContentFlow-AI
```

#### 2. Install dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd client
npm install

# Install backend dependencies
cd ../server
npm install
```

#### 3. Environment Setup

Create `.env` files in both `client/` and `server/` directories with your configuration:

**client/.env:**
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_API_URL=http://localhost:5000
```

**server/.env:**
```
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
PORT=5000
GOOGLE_OAUTH_CLIENT_ID= your_information
GOOGLE_OAUTH_CLIENT_SECRET= your_information
GOOGLE_OAUTH_REDIRECT_URI= your_information
GOOGLE_OAUTH_SUCCESS_REDIRECT= your_information
GOOGLE_OAUTH_ERROR_REDIRECT= your_information
GOOGLE_OAUTH_STATE_SECRET= your_information
DRIVE_TOKEN_ENCRYPTION_KEY= your_information
```

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Frontend (from client/):**
```bash
cd client
npm run dev
```
Access the app at `http://localhost:5173`

**Terminal 2 - Backend (from server/):**
```bash
cd server
npm start
```
Backend runs on `http://localhost:5000`

### Production Build

**Frontend:**
```bash
cd client
npm run build
npm run preview
```

## 🧪 Testing

### Frontend Tests
```bash
cd client

# Run tests once
npm test

# Run tests in watch mode
npm test:watch
```

Tests use Vitest and Testing Library. See [Frontend Setup Guide](#frontend-setup-client) for detailed configuration.

### Backend Tests
```bash
cd server
npm test
```

Tests use Jest. See [Backend Setup Guide](#backend-setup-server) for detailed configuration.

### Testing Setup Details

#### Backend Setup (server/)
1. Jest is configured for running all `*.test.js` files in `server/test/`
2. Run with: `npm test`

#### Frontend Setup (client/)
1. Vitest is configured with jsdom environment
2. Tests are located in `client/src/__tests__/`
3. Run with: `npm test` for single run or `npm test:watch` for watch mode

## 📝 Available Scripts

### Frontend (client/)
| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests once |
| `npm test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

### Backend (server/)
| Script | Description |
|--------|-------------|
| `npm start` | Start the server |
| `npm test` | Run tests with Jest |

## 🔑 Key Features in Detail

### Firebase Integration
- User authentication
- Real-time database for content storage
- Cloud functions for backend processing

### Google APIs
- Content generation with Generative AI
- Integration with Google workspace services

### Frontend Architecture
- Component-based React structure
- Client-side routing with React Router
- ESLint for code quality

**Last Updated:** 2026-04-23 07:11:00
