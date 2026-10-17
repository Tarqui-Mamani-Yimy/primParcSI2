const viteEnv = (import.meta as any).env;

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0');

export const environment = {
  production: viteEnv.PROD,
  apiUrl:
    viteEnv.VITE_API_URL ||
    (isLocalhost
      ? 'http://127.0.0.1:8000'
      : viteEnv.PROD
      ? 'https://primparcsi2.onrender.com'
      : 'http://127.0.0.1:8000'),
  stripePublishableKey: viteEnv.VITE_STRIPE_PUBLISHABLE_KEY || '',
};
