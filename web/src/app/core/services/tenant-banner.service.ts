import { computed, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

export interface TenantBanner {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  dismissible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TenantBannerService {
  private activeBannerSignal = signal<TenantBanner | null>(null);

  constructor(private authService: AuthService) {}

  public banner = computed<TenantBanner | null>(() => {
    const active = this.activeBannerSignal();
    if (active) return active;

    const suscripcion = this.authService.suscripcion();
    if (suscripcion && suscripcion.estado && suscripcion.estado !== 'activa') {
      const estado = suscripcion.estado;
      return {
        type: 'error',
        title: `Suscripción ${estado === 'suspendida' ? 'Suspendida' : 'Inactiva'}`,
        message: `La suscripción de la empresa está ${estado}. Las operaciones de modificación están bloqueadas hasta regularizar el estado.`,
        dismissible: false,
      };
    }

    return null;
  });

  showBanner(banner: TenantBanner) {
    this.activeBannerSignal.set(banner);
  }

  dismiss() {
    this.activeBannerSignal.set(null);
  }
}
