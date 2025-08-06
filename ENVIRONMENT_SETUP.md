# Environment Setup Guide

This guide will help you set up the Kaneo development environment and troubleshoot common issues.

## Quick Start

1. Copy the sample environment files:
   ```bash
   cp apps/api/.env.sample apps/api/.env
   cp apps/web/.env.sample apps/web/.env
   ```

2. Update the environment variables in both files (see sections below)

3. Start the development servers:
   ```bash
   pnpm dev
   ```

## API Environment Variables

Create `apps/api/.env` with the following variables:

### Required Variables

- `DATABASE_URL`: PostgreSQL connection string
  ```
  DATABASE_URL=postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo
  ```

- `JWT_ACCESS`: Secret key for JWT token generation
  ```
  JWT_ACCESS=your-development-secret-here
  ```

### Optional Variables

- `DISABLE_REGISTRATION`: Set to "true" to disable new user registration
- `DEMO_MODE`: Set to "true" to enable demo mode for testing
- `CORS_ORIGINS`: Comma-separated list of allowed origins
  ```
  CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
  ```
- `PORT`: API server port (default: 1337)

### GitHub Integration (Optional)

- `GITHUB_APP_ID`: GitHub App ID for repository integration
- `GITHUB_PRIVATE_KEY`: GitHub App Private Key (PEM format)
- `GITHUB_WEBHOOK_SECRET`: GitHub App Webhook Secret
- `GITHUB_APP_NAME`: GitHub App Name

## Frontend Environment Variables

Create `apps/web/.env` with the following variables:

### Required Variables

- `VITE_API_URL`: URL of the API server
  ```
  VITE_API_URL=http://localhost:1337
  ```

### Optional Variables

- `VITE_APP_URL`: App URL for generating links
  ```
  VITE_APP_URL=http://localhost:3000
  ```

## Common Issues & Troubleshooting

### CORS Errors

**Symptoms:**
- "Failed to fetch" errors in browser console
- Network errors when making API requests
- "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Solutions:**

1. **Check API URL Configuration:**
   - Ensure `VITE_API_URL` in frontend `.env` matches your API server URL
   - Verify the API server is running on the correct port

2. **Configure CORS Origins:**
   - Add your frontend URL to `CORS_ORIGINS` in API `.env`:
     ```
     CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
     ```
   - For development, you can leave `CORS_ORIGINS` empty to allow all origins

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
   - Test connection: `psql postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo`

2. **Update DATABASE_URL:**
   - Ensure the connection string format is correct
   - Check username, password, host, port, and database name

### Authentication Issues

**Symptoms:**
- "Authentication failed" errors
- Users can't sign in

**Solutions:**

1. **Check JWT Configuration:**
   - Ensure `JWT_ACCESS` is set in API `.env`
   - Use a strong secret in production

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
- Leave `CORS_ORIGINS` empty to allow all origins
- Use simple JWT secrets (not for production)

### Production
- Use HTTPS for both frontend and API
- Set specific `CORS_ORIGINS` for security
- Use strong, unique JWT secrets
- Configure proper database credentials

## Getting Help

If you're still experiencing issues:

1. Check the browser console for detailed error messages
2. Review the API server logs
3. Verify all environment variables are set correctly
4. Ensure all services (PostgreSQL, API, Frontend) are running

The application now includes enhanced error handling that will provide specific troubleshooting steps for common issues like CORS problems.

## Testing Error Handling

You can test the error handling by visiting `/test-error` in your browser. This will show you how the error display component looks and what troubleshooting steps are provided for different types of errors. 