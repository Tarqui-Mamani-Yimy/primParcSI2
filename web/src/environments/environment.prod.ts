export const environment = {
  production: true,
  apiUrl: (import.meta as any).env?.VITE_API_URL || 'https://primparcsi2.onrender.com',
  stripePublishableKey: (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || '',
};