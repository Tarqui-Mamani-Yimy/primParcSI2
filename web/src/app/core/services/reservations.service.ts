import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Reserva, ReservaIn } from '../models';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class ReservationsService {
  private reservationsSignal = signal<Reserva[]>([]);
  public reservations = this.reservationsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {}

  loadReservations(): Promise<void> {
    return firstValueFrom(
      this.http.get<Reserva[]>(`${API_URL}/api/reservations`)
    ).then((list) => {
      this.reservationsSignal.set(list);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo cargar la lista de reservas.');
    });
  }

  createReservation(payload: ReservaIn): Promise<Reserva | null> {
    // idCliente nunca va en el payload: el backend lo deriva del JWT
    // cuando el llamante es un Cliente autenticado.
    return firstValueFrom(
      this.http.post<Reserva>(`${API_URL}/api/reservations`, payload)
    ).then((reserva) => {
      this.reservationsSignal.update(list => [reserva, ...list]);
      this.notificationService.success('Reserva creada', 'Tu reserva quedó registrada como pendiente.');
      return reserva;
    }).catch((err) => {
      const msg = err.error?.detail || 'No se pudo crear la reserva.';
      this.notificationService.error('Error', msg);
      return null;
    });
  }

  cancelReservation(codigoReserva: number): Promise<boolean> {
    return firstValueFrom(
      this.http.put<Reserva>(`${API_URL}/api/reservations/${codigoReserva}/cancel`, {})
    ).then((reserva) => {
      this.reservationsSignal.update(list => list.map(r => r.codigoReserva === codigoReserva ? reserva : r));
      this.notificationService.warning('Reserva cancelada', `La reserva #${codigoReserva} fue cancelada.`);
      return true;
    }).catch((err) => {
      const msg = err.error?.detail || 'No se pudo cancelar la reserva.';
      this.notificationService.error('Error', msg);
      return false;
    });
  }
}
