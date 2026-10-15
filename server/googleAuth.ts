/**
 * @file googleAuth.ts
 * @description Configuration for Google OAuth 2.0 Authentication Strategy.
 * Handles user login, session management, and user creation/updating on login.
 * 
 * @functionality
 * - setupGoogleAuth: Configures Passport.js, Express Session, and Google Strategy.
 * - isAuthenticated: Middleware to check if a user session exists.
 * - User Upsert: Automatically creates or updates users in DB upon Google login.
 * - Admin Detection: hardcoded check for specific email to assign 'admin' role initially.
 * 
 * @dependencies
 * - passport: Authentication middleware.
 * - passport-google-oauth20: Google Strategy.
 * - express-session: Session management.
 * - connect-pg-simple: PostgreSQL session store.
 * - storage: Database interaction.
 * 
 * @breaking-changes
 * - Environment Variables: Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DATABASE_URL.
 * - Session Table: Requires 'sessions' table in Postgres (handled by connect-pg-simple).
 */

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express } from "express";
import { storage } from "./storage";

// Google authentication middleware
export const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated() && req.user?.id) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

export function setupGoogleAuth(app: Express) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth credentials not found. Google authentication will be disabled.");
    return;
  }

  // Configure session with PostgreSQL store
  const sessionTtl = 24 * 60 * 60 * 1000; // 24 hours (Strict Daily Login)
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  // SEC-01 Fix: Fail fast if SESSION_SECRET is not configured.
  // Never use a fallback secret in production — it would allow session forgery.
  if (!process.env.SESSION_SECRET) {
    throw new Error("[SECURITY] SESSION_SECRET environment variable is required but not set. Refusing to start.");
  }

  app.use(session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on every response (Idle timeout simulation)
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // CSRF Mitigation
      maxAge: sessionTtl
    }
  }));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Determine the base URL based on environment
  const getBaseUrl = () => {
    // 1. Explicit BASE_URL (User configured)
    if (process.env.BASE_URL) {
      console.log('googleAuth: Using configured BASE_URL:', process.env.BASE_URL);
      return process.env.BASE_URL;
    }

    // 2. Railway Auto-generated Variables
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      const url = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
      console.log('googleAuth: Detected Railway Public Domain:', url);
      return url;
    }
    if (process.env.RAILWAY_STATIC_URL) {
      const url = `https://${process.env.RAILWAY_STATIC_URL}`;
      console.log('googleAuth: Detected Railway Static URL:', url);
      return url;
    }

    // 3. Replit Fallback
    if (process.env.REPLIT_DEPLOYMENT) {
      return 'https://saha-tracker.replit.app';
    }

    // 4. Localhost Fallback
    const localUrl = `http://localhost:${process.env.PORT || 5000}`;
    console.warn('googleAuth: Falling back to localhost. If in production, ensure BASE_URL is set.');
    return localUrl;
  };

  const baseUrl = getBaseUrl();
  console.log(`Google OAuth configured for: ${baseUrl}`);

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${baseUrl}/api/auth/google/callback`,
    scope: ['profile', 'email'],
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;

        // Admin Bootstrap Strategy
        // If INITIAL_ADMIN_EMAIL is set and matches, grant admin.
        // Otherwise, no one gets admin by default.
        const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
        const isAdmin = initialAdminEmail && email && (email.toLowerCase() === initialAdminEmail.toLowerCase());

        // Create or update user with Google profile data
        const user = await storage.upsertUser({
          id: profile.id,
          email: email,
          firstName: profile.name?.givenName || null,
          lastName: profile.name?.familyName || null,
          profileImageUrl: profile.photos?.[0]?.value || null,
          role: isAdmin ? "admin" : "estimator",
          status: isAdmin ? "approved" : "pending",
          approvedBy: isAdmin ? profile.id : null,
          approvedAt: isAdmin ? new Date() : null
        });

        const userWithProvider = { ...user, provider: "google" };
        return done(null, userWithProvider);
      } catch (error) {
        console.error("Google OAuth error:", error);
        return done(error, false);
      }
    }));

  // SEC-05 Fix: Serialize only the user ID into the session, not the full user object.
  // This prevents stale role/status data persisting in sessions and reduces DB exposure.
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ? { ...user, provider: 'google' } : null);
    } catch (err) {
      done(err, null);
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      accessType: "offline"
    })
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/auth/error"
    })
  );

  // Auth status endpoint for Google users
  app.get("/api/auth/google/user", (req, res) => {
    if (req.isAuthenticated() && req.user?.provider === "google") {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated with Google" });
    }
  });

  // Logout for Google users
  app.get("/auth/google/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.redirect(getBaseUrl());
    });
  });
}