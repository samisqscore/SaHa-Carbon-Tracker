# Google OAuth Implementation Guide

This guide provides a complete implementation of Google OAuth authentication for Node.js/Express applications using Passport.js.

## Overview

This implementation provides:
- Google OAuth 2.0 authentication
- Session management with PostgreSQL storage
- User profile data extraction
- Secure authentication middleware
- Multi-domain support for development and production

## Prerequisites

- Node.js application with Express
- PostgreSQL database
- Google Cloud Console project with OAuth credentials

## Required Dependencies

```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "express-session": "^1.17.3",
  "connect-pg-simple": "^9.0.1",
  "dotenv": "^16.0.0"
}
```

Install dependencies:
```bash
npm install passport passport-google-oauth20 express-session connect-pg-simple dotenv
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database Connection
DATABASE_URL=postgresql://username:password@host:port/database

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Application URLs (comma-separated for multiple domains)
REPLIT_DOMAINS=localhost:5000,yourdomain.com,yourapp.replit.app
```

## Database Schema

Create the following tables in your PostgreSQL database:

```sql
-- Users table for storing user profiles
CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role VARCHAR DEFAULT 'user',
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table for session storage
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);
```

## Implementation Files

### 1. Google Auth Configuration (`server/googleAuth.js`)

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const connectPg = require('connect-pg-simple');
const { storage } = require('./storage'); // Your storage implementation

// Configure session store
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: 'sessions',
  });

  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Extract user data from Google profile
    const userData = {
      id: profile.id,
      email: profile.emails?.[0]?.value || null,
      firstName: profile.name?.givenName || null,
      lastName: profile.name?.familyName || null,
      profileImageUrl: profile.photos?.[0]?.value || null,
    };

    // Create or update user in database
    const user = await storage.upsertUser(userData);
    return done(null, user);
  } catch (error) {
    console.error('OAuth authentication error:', error);
    return done(error, null);
  }
}));

// Serialize/deserialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
};

// Setup function for Express app
function setupGoogleAuth(app) {
  // Trust proxy for secure cookies
  app.set('trust proxy', 1);
  
  // Session middleware
  app.use(getSession());
  
  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Authentication routes
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // Successful authentication
      res.redirect('/dashboard'); // Redirect to your app's main page
    }
  );

  app.get('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.redirect('/');
    });
  });

  app.get('/api/auth/user', isAuthenticated, (req, res) => {
    res.json(req.user);
  });
}

module.exports = {
  setupGoogleAuth,
  isAuthenticated
};
```

### 2. Storage Interface (`server/storage.js`)

```javascript
const { Pool } = require('pg');

class DatabaseStorage {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  // Get user by ID
  async getUser(id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  // Create or update user
  async upsertUser(userData) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO users (id, email, first_name, last_name, profile_image_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          profile_image_url = EXCLUDED.profile_image_url,
          updated_at = NOW()
        RETURNING *
      `, [
        userData.id,
        userData.email,
        userData.firstName,
        userData.lastName,
        userData.profileImageUrl
      ]);
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Get user by email
  async getUserByEmail(email) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }
}

const storage = new DatabaseStorage();
module.exports = { storage };
```

### 3. Express Server Setup (`server/index.js`)

```javascript
const express = require('express');
const { setupGoogleAuth, isAuthenticated } = require('./googleAuth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Google OAuth
setupGoogleAuth(app);

// Protected route example
app.get('/api/protected', isAuthenticated, (req, res) => {
  res.json({ 
    message: 'This is a protected route',
    user: req.user 
  });
});

// Public routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 4. Frontend React Hook (`client/hooks/useAuth.js`)

```javascript
import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    error
  };
}
```

### 5. Frontend Auth Utils (`client/utils/authUtils.js`)

```javascript
export function isUnauthorizedError(error) {
  return error?.message?.includes('401') || 
         error?.message?.includes('Unauthorized');
}

export function redirectToLogin() {
  window.location.href = '/api/auth/google';
}

export function logout() {
  window.location.href = '/api/auth/logout';
}
```

### 6. Frontend Login Component (`client/components/LoginButton.jsx`)

```jsx
import React from 'react';

export function LoginButton() {
  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <button 
      onClick={handleLogin}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Sign in with Google
    </button>
  );
}
```

## Google Cloud Console Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Google+ API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback` (development)
     - `https://yourdomain.com/api/auth/google/callback` (production)

4. **Get Client ID and Secret**
   - Copy the Client ID and Client Secret
   - Add them to your `.env` file

## Security Best Practices

1. **Environment Variables**: Never commit credentials to version control
2. **Session Security**: Use secure cookies in production
3. **HTTPS**: Always use HTTPS in production
4. **Session Timeout**: Configure appropriate session timeouts
5. **Input Validation**: Validate all user inputs
6. **Rate Limiting**: Implement rate limiting for auth endpoints

## Deployment Considerations

### Development
- Use HTTP for local development
- Set `secure: false` for cookies
- Use localhost in redirect URIs

### Production
- Use HTTPS only
- Set `secure: true` for cookies
- Use production domain in redirect URIs
- Set proper CORS policies

## Usage Examples

### Protected Route
```javascript
app.get('/api/user/profile', isAuthenticated, (req, res) => {
  res.json(req.user);
});
```

### Frontend Authentication Check
```jsx
function App() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isAuthenticated ? (
        <Dashboard user={user} />
      ) : (
        <LoginPage />
      )}
    </div>
  );
}
```

This implementation provides a complete, production-ready Google OAuth system that you can adapt to your specific project needs.