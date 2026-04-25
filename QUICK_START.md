# Quick Start - Deploy Sterling Bank to Vercel

## 5-Minute Setup

### 1. Get Your Credentials

**PostgreSQL** (pick one):
- Neon: https://neon.tech → Copy connection string
- Supabase: https://supabase.com → Get PostgreSQL URL
- Your own: Get PostgreSQL connection string

**Redis**:
- Upstash: https://upstash.com → Create free database, copy REST URL & TOKEN

**JWT Secret**:
- Generate: `openssl rand -base64 32`

### 2. Add Environment Variables to Vercel

Go to your Vercel project → Settings → Environment Variables

Add these 5 required variables:
```
DATABASE_URL = your_postgresql_url
SESSION_SECRET = your_generated_secret
UPSTASH_REDIS_REST_URL = your_upstash_url
UPSTASH_REDIS_REST_TOKEN = your_upstash_token
FRONTEND_URL = https://your-project.vercel.app
```

Optional (for email):
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your_email@gmail.com
SMTP_PASSWORD = your_app_password
SMTP_FROM = noreply@sterlingbank.com
```

### 3. Deploy

```bash
# Push to main branch
git add .
git commit -m "Deploy to Vercel serverless"
git push origin main

# Or use Vercel CLI
vercel deploy --prod
```

### 4. Test It Works

```bash
# Test health endpoint
curl https://your-project.vercel.app/api/health

# Should return:
# {"status":"ok","timestamp":"2024-...","version":"2.0.0-serverless"}
```

## That's It!

Your Sterling Bank is now live on Vercel serverless with:
- ✓ All authentication working
- ✓ Wallet management operational
- ✓ Transaction processing active
- ✓ Real-time updates via Redis
- ✓ Email notifications ready

## Common Tasks

### Test the API

```bash
# Register user
curl -X POST https://your-project.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@example.com",
    "username":"testuser",
    "firstName":"Test",
    "lastName":"User",
    "phone":"+12345678900",
    "country":"US",
    "password":"TestPass123",
    "confirmPassword":"TestPass123"
  }'

# Login
curl -X POST https://your-project.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@example.com",
    "password":"TestPass123"
  }'

# Get wallet (use token from login response)
curl https://your-project.vercel.app/api/wallet \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Logs

1. Go to Vercel Dashboard
2. Click on Deployments
3. Click latest deployment
4. View Logs tab

### Troubleshoot

**"DATABASE_URL not set"**
- Add DATABASE_URL to Vercel env vars
- Redeploy

**"Upstash Redis not configured"**
- Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
- Redeploy

**"Slow response"**
- First request takes 1-3 seconds (cold start)
- Subsequent requests are instant

**"Function timeout"**
- API functions have 30 second max
- Check database performance
- Review function logs

## Next Steps

1. Read `VERCEL_DEPLOYMENT.md` for detailed guide
2. Add more routes (cards, KYC, crypto, etc.)
3. Setup custom domain
4. Configure monitoring (Sentry, etc.)
5. Setup CI/CD for testing

## What's Running

- **Frontend**: Vite React app on Vercel
- **API**: 15 serverless functions
- **Database**: PostgreSQL (connection pooled)
- **Real-time**: Upstash Redis pub/sub
- **Email**: SMTP notifications
- **Auth**: JWT + bcrypt

## URLs to Remember

- Frontend: `https://your-project.vercel.app`
- API: `https://your-project.vercel.app/api`
- Health: `https://your-project.vercel.app/api/health`

## Support

- Issues? Check `VERCEL_DEPLOYMENT.md`
- Need help? Check `SERVERLESS_REFACTOR_SUMMARY.md`
- Questions? See documentation links below

## Documentation

- Full Guide: `VERCEL_DEPLOYMENT.md`
- What Changed: `SERVERLESS_REFACTOR_SUMMARY.md`
- Vercel Docs: https://vercel.com/docs
- Upstash Docs: https://upstash.com/docs

---

That's it! Your bank is ready. Deploy and go live!
