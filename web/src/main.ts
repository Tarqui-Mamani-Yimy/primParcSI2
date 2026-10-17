import 'zone.js';
import './index.css';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { multitenantErrorInterceptor } from './app/core/interceptors/multitenant-error.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor, multitenantErrorInterceptor])),
  ]
}).catch(err => console.error(err));
