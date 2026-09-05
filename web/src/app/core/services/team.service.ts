import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TeamMember, AuditLogEntry } from '../models';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private teamMembersSignal = signal<TeamMember[]>([]);
  private auditLogsSignal = signal<AuditLogEntry[]>([]);

  public teamMembers = this.teamMembersSignal.asReadonly();
  public auditLogs = this.auditLogsSignal.asReadonly();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService,
  ) {}

  loadTeam(): Promise<void> {
    return firstValueFrom(
      this.http.get<TeamMember[]>(`${API_URL}/api/team`)
    ).then((members) => {
      this.teamMembersSignal.set(members);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo cargar el equipo.');
    });
  }

  loadAuditLog(): Promise<void> {
    return firstValueFrom(
      this.http.get<AuditLogEntry[]>(`${API_URL}/api/team/audit-log`)
    ).then((logs) => {
      this.auditLogsSignal.set(logs);
    }).catch(() => {
      this.notificationService.error('Error', 'No se pudo cargar la bitácora.');
    });
  }

  addMember(member: Omit<TeamMember, 'idUser'>): Promise<TeamMember | null> {
    this.notificationService.warning('No disponible', 'La creación de miembros estará disponible en Fase 2.');
    return Promise.resolve(null);
  }

  togglePermission(userId: string, permission: string): Promise<boolean> {
    this.notificationService.warning('No disponible', 'La gestión de permisos estará disponible en Fase 2.');
    return Promise.resolve(false);
  }
}
