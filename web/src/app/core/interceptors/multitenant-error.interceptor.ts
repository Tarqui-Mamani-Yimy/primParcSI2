import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { TenantBannerService } from '../services/tenant-banner.service';
import { MultitenantErrorDetail } from '../models';

const FEATURE_NAMES: Record<string, string> = {
  pos: 'Punto de Venta (POS)',
  inventario: 'Inventario Global',
  ventas: 'Ventas y Facturación',
  reportes: 'Reportes de Ventas e Inventario',
  despachos: 'Despachos y Logística',
  reservas: 'Reservas de Clientes',
  pagos_online: 'Pagos en Línea',
  app_movil: 'Aplicación Móvil',
  reportes_avanzados: 'Reportes Avanzados e Indicadores',
  reportes_export: 'Exportación de Reportes',
  ia: 'Inteligencia Artificial',
  probador: 'Probador Virtual',
};

const RECURSO_NAMES: Record<string, string> = {
  sucursales: 'sucursales',
  usuarios: 'usuarios',
  productos: 'productos',
};

export const multitenantErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const bannerService = inject(TenantBannerService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const detail = error.error?.detail;
        if (detail && typeof detail === 'object' && 'code' in detail) {
          const code = (detail as { code: string }).code;

          if (error.status === 403) {
            (error as any).multitenantHandled = true;
            const multitenantError = detail as MultitenantErrorDetail;

            switch (multitenantError.code) {
              case 'feature_not_in_plan': {
                const featureLabel = FEATURE_NAMES[multitenantError.feature] || multitenantError.feature;
                const title = 'Función no disponible en tu plan';
                const message = `El módulo "${featureLabel}" no está incluido en tu plan actual. Actualizá tu suscripción para acceder.`;
                notificationService.warning(title, message);
                bannerService.showBanner({
                  type: 'warning',
                  title,
                  message,
                  dismissible: true,
                });
                break;
              }

              case 'plan_limit_reached': {
                const recursoLabel = RECURSO_NAMES[multitenantError.recurso] || multitenantError.recurso;
                const title = 'Límite del plan alcanzado';
                const message = `Has alcanzado el límite máximo de ${recursoLabel} (${multitenantError.limite}) permitido por tu plan.`;
                notificationService.warning(title, message);
                bannerService.showBanner({
                  type: 'warning',
                  title,
                  message,
                  dismissible: true,
                });
                break;
              }

              case 'subscription_inactive': {
                const estado = multitenantError.estado;
                const estadoStr = estado === 'suspendida' ? 'suspendida' : 'inactiva o vencida';
                const title = 'Suscripción no activa';
                const message = `La suscripción de tu empresa está ${estadoStr}. Las operaciones de modificación están bloqueadas temporalmente.`;
                notificationService.error(title, message);
                bannerService.showBanner({
                  type: 'error',
                  title,
                  message,
                  dismissible: false,
                });
                break;
              }
            }
          } else if (error.status === 409) {
            if (code === 'billing_already_active') {
              (error as any).multitenantHandled = true;
              notificationService.warning(
                'Suscripción activa',
                'Tu empresa ya cuenta con una suscripción activa de Stripe. Gestioná tu plan o método de pago desde el portal de facturación.'
              );
            } else if (code === 'billing_not_configured') {
              (error as any).multitenantHandled = true;
              notificationService.warning(
                'Facturación no configurada',
                'Tu empresa aún no posee un cliente de facturación configurado en Stripe. Suscribite a un plan primero.'
              );
            }
          } else if (error.status === 503) {
            if (code === 'stripe_not_configured') {
              (error as any).multitenantHandled = true;
              notificationService.error(
                'Servicio no disponible',
                'El servicio de facturación de Stripe no está configurado en el servidor. Contactá con soporte técnico.'
              );
            }
          }
        }
      }

      return throwError(() => error);
    })
  );
};
