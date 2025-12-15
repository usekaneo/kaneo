# Environment Setup Guide

This guide will help you set up the Kaneo development environment and troubleshoot common issues.

## Quick Start

1. **Create a `.env` file** in the root of the project with the required environment variables (see the [documentation](https://kaneo.app/docs/core/installation/environment-variables) for the complete list).

2. **Start the development servers**:
   ```bash
   pnpm dev
   ```

This starts both the API (port 1337) and web app (port 5173). Both will automatically reload when you make changes.

> **Tip**: The web app at http://localhost:5173 will automatically connect to the API at http://localhost:1337

## Environment Variables

Kaneo uses a **single `.env` file** in the root of the project for all environment variables. This file is shared by both the API and web services.

### Required Variables

For development, you'll need at minimum:

- `KANEO_CLIENT_URL` - The URL of the web application (e.g., `http://localhost:5173`)
- `KANEO_API_URL` - The URL of the API (e.g., `http://localhost:1337`)
- `AUTH_SECRET` - Secret key for JWT token generation (**must be at least 32 characters long**; use a long, random value in production)
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_DB` - PostgreSQL database name
- `POSTGRES_USER` - PostgreSQL username
- `POSTGRES_PASSWORD` - PostgreSQL password

### Development-Specific Variables

For local development, the web app also supports:
- `VITE_API_URL` - API URL for development (defaults to `http://localhost:1337` if not set)
- `VITE_APP_URL` - App URL for generating links (optional)

### Optional Variables

Kaneo supports many optional configuration options including:
- SSO providers (GitHub, Google, Discord, Custom OAuth/OIDC)
- SMTP configuration for email
- Access control settings
- CORS configuration

For a complete list of all environment variables, their descriptions, and configuration options, see the [official documentation](https://kaneo.app/docs/core/installation/environment-variables).

## Common Issues & Troubleshooting

### CORS Errors

**Symptoms:**
- "Failed to fetch" errors in browser console
- Network errors when making API requests
- "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Solutions:**

1. **Check URL Configuration:**
   - Ensure `KANEO_API_URL` matches your API server URL
   - Ensure `KANEO_CLIENT_URL` matches your web app URL
   - For development, you can also set `VITE_API_URL` in your `.env` file

2. **Configure CORS Origins:**
   - Add your frontend URL to `CORS_ORIGINS` in your `.env`:
     ```
     CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
     ```
   - For development, you can leave `CORS_ORIGINS` empty to allow all origins
   - **Note:** `CORS_ORIGINS` should match `KANEO_CLIENT_URL` for proper authentication

3. **Check Protocol Consistency:**
   - Ensure both frontend and API use the same protocol (http/https)
   - Don't mix http and https in development

4. **Verify Server Accessibility:**
   - Test if the API is accessible: `curl http://localhost:1337/config`
   - Check if the server is running on the correct port

### Database Connection Issues

**Symptoms:**
- "Database connection failed" errors
- API server won't start

**Solutions:**

1. **Check PostgreSQL:**
   - Ensure PostgreSQL is running
   - Verify database exists and credentials are correct
   - Test connection: `psql $DATABASE_URL`

2. **Update DATABASE_URL:**
   - Ensure the connection string format is correct
   - Check username, password, host, port, and database name

### Authentication Issues

**Symptoms:**
- "Authentication failed" errors
- Users can't sign in

**Solutions:**

1. **Check Authentication Configuration:**
   - Ensure `AUTH_SECRET` is set in your `.env` file
   - Use a strong secret in production
   - Verify `KANEO_CLIENT_URL` and `KANEO_API_URL` are correctly configured

2. **Clear Browser Data:**
   - Clear cookies and local storage
   - Try in incognito/private mode

### Network Errors

**Symptoms:**
- "Network error" messages
- API requests timeout

**Solutions:**

1. **Check Server Status:**
   - Verify API server is running
   - Check server logs for errors

2. **Check Firewall/Proxy:**
   - Ensure ports are not blocked
   - Check if proxy settings interfere

3. **Verify URLs:**
   - Check that all URLs are accessible
   - Test with curl or browser

## Development vs Production

### Development
- Use `http://localhost` for both frontend and API
- Leave `CORS_ORIGINS` empty to allow all origins (or set it to match your local URLs)
- Use simple secrets for `AUTH_SECRET` (not for production)
- The web app will use `VITE_API_URL` if set, otherwise defaults to `http://localhost:1337`

### Production
- Use HTTPS for both frontend and API
- Set specific `CORS_ORIGINS` for security (should match `KANEO_CLIENT_URL`)
- Use strong, unique secrets for `AUTH_SECRET`
- Configure proper database credentials
- Ensure `KANEO_CLIENT_URL` and `KANEO_API_URL` are set to your production URLs

## Getting Help

If you're still experiencing issues:

1. Check the browser console for detailed error messages
2. Review the API server logs
3. Verify all environment variables are set correctly
4. Ensure all services (PostgreSQL, API, Frontend) are running
5. Consult the [official documentation](https://kaneo.app/docs) for detailed guides and troubleshooting

For the most up-to-date information on environment variables and configuration, always refer to the [official documentation](https://kaneo.app/docs/core/installation/environment-variables).
