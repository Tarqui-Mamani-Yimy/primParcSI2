const isProd = (import.meta as any).env?.PROD ?? false;

export const environment = {
  production: isProd,
  apiUrl:
    (import.meta as any).env?.VITE_API_URL ||
    (isProd ? 'https://primparcsi2.onrender.com' : 'http://localhost:8000'),
};
