// Environment configuration for Vercel deployment
export const config = {
  // API configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 30000,
  },

  // Frontend configuration
  app: {
    name: 'Sterling Bank',
    version: '2.0.0',
  },

  // Feature flags
  features: {
    websocketEnabled: false, // Using Redis pub/sub instead
    redisEnabled: true,
    cryptoEnabled: true,
  },

  // Endpoints
  endpoints: {
    auth: {
      register: '/auth/register',
      login: '/auth/login',
      verify: '/auth/verify-otp',
      me: '/auth/me',
    },
    wallet: {
      getWallet: '/wallet',
      getPortfolio: '/wallet/portfolio',
      deposit: '/wallet/deposit',
    },
    transactions: {
      getAll: '/transactions',
      transfer: '/transactions/transfer',
      withdraw: '/transactions/withdraw',
      lookupRecipient: '/transactions/lookup-recipient',
      getReceipt: '/transactions/receipt',
    },
  },
};

export default config;
