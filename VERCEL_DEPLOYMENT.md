# Vercel Deployment Guide for Sterling Bank

This guide explains how to deploy the Sterling Bank monorepo to Vercel with Neon database integration.

## Prerequisites

- Vercel account (https://vercel.com)
- Neon PostgreSQL database (https://neon.tech)
- GitHub repository connected to Vercel

## Step 1: Set Up Neon Database

1. Create a Neon project at https://console.neon.tech
2. Create a database (e.g., `sterling_bank`)
3. Copy your connection string (it will look like: `postgresql://user:password@host.neon.tech/dbname`)

## Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Neon connection string from Step 1
   - **Environment**: Select all environments (Production, Preview, Development)

4. Click **Save**

## Step 3: Deploy to Vercel

### Option A: Via Git (Recommended)
1. Push your changes to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: add Vercel deployment configuration with Neon database"
   git push origin main
   ```

2. Vercel will automatically detect the changes and start the deployment

### Option B: Via Vercel CLI
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel deploy
   ```

## Project Structure

This monorepo contains three deployable projects:

- **api-server**: Express.js backend with Drizzle ORM
  - Port: 3000 (by default)
  - Database: PostgreSQL (Neon)
  
- **sterling-crest**: React frontend (Vite)
  - Port: 5173 (development), 3001 (production)
  
- **mockup-sandbox**: React mockup/demo (Vite)
  - Port: 5174 (development), 3002 (production)

## Build Process

The build process automatically:
1. Installs all dependencies using pnpm
2. Builds each project in the workspace
3. Runs database migrations using Drizzle ORM
4. Outputs the compiled artifacts

### Database Migrations

Migrations run automatically during the build process via `scripts/migrate-db.js`:
- Creates/updates tables based on the schema defined in `lib/db/src/schema/`
- Uses Drizzle Kit's "push" strategy
- Requires the `DATABASE_URL` environment variable to be set

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string (from Neon)

### Optional

- `NODE_ENV`: Set to "production" on Vercel (automatic)

## Troubleshooting

### Build Fails with "DATABASE_URL not set"
- Verify the `DATABASE_URL` environment variable is added in Vercel Settings
- Make sure it's added to all environments (Production, Preview, Development)
- Redeploy after adding the variable

### Database Connection Fails
- Check if your Neon project allows connections from Vercel IPs
- Verify the connection string is correct
- Test the connection locally with: `psql <DATABASE_URL>`

### Migrations Fail
- Ensure your schema files in `lib/db/src/schema/` are valid
- Check Drizzle ORM documentation for schema syntax
- Run locally first: `pnpm run --filter @workspace/db push`

## Local Development

To test locally before deploying:

1. Create a local PostgreSQL database or use Neon
2. Set up `.env.local`:
   ```bash
   DATABASE_URL=postgresql://user:password@localhost/sterling_bank
   ```

3. Run migrations:
   ```bash
   pnpm run --filter @workspace/db push
   ```

4. Start development servers:
   ```bash
   pnpm run dev
   ```

## Viewing Logs

In Vercel Dashboard:
1. Go to **Deployments**
2. Click on a deployment
3. View build and runtime logs in the **Logs** tab

## Next Steps

After successful deployment:
1. Test all three services are running
2. Verify database connectivity
3. Set up custom domains (optional)
4. Configure monitoring and alerts (optional)

## Support

- Vercel Docs: https://vercel.com/docs
- Neon Docs: https://neon.tech/docs
- Drizzle ORM: https://orm.drizzle.team
