export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  stripePublishableKey: (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || '',
};
