import angular from '@analogjs/vite-plugin-angular';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({command}) => {
  return {
    plugins: [
      angular({
        tsconfig: path.resolve(__dirname, 'tsconfig.app.json'),
      }),
      tailwindcss()
    ],
    resolve: {
      alias: [
        {find: '@', replacement: path.resolve(__dirname, '.')},
        // No hay angular.json/fileReplacements en este setup (Vite puro),
        // asi que en el build de produccion redirigimos cualquier import
        // "*/environments/environment" hacia environment.prod.ts. Sin esto
        // el build empaqueta la URL de localhost:8000 de environment.ts.
        ...(command === 'build'
          ? [
              {
                find: '../../../environments/environment',
                replacement: path.resolve(__dirname, 'src/environments/environment.prod.ts'),
              },
            ]
          : []),
      ],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
