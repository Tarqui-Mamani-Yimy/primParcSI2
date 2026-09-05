import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../core/services/team.service';
import { TeamMember } from '../../core/models';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">

      <!-- Encabezado -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Gobernanza de Seguridad y RBAC</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">Directorio de Personal y Nodos de Acceso</h1>
          <p class="text-xs text-gray-500 mt-1">
            Permisos basados en roles, registros de actividad y autorización de nodos administrativos.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <div class="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
            Crear/Editar: Fase 2
          </div>
        </div>
      </div>

      <!-- Tarjetas de personal -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          *ngFor="let member of teamService.teamMembers()"
          class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:border-gray-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="flex items-start justify-between mb-3.5">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-200">
                  {{ member.nombre.substring(0, 2).toUpperCase() }}
                </div>
                <div>
                  <h3 class="text-sm font-bold text-gray-900">{{ member.nombre }}</h3>
                  <p class="text-xs text-gray-500 truncate max-w-[140px]">{{ member.email }}</p>
                </div>
              </div>

              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                [ngClass]="getRolBadgeClass(member.rol)"
              >
                {{ member.rol }}
              </span>
            </div>

            <div class="mt-3.5 pt-3 border-t border-gray-100">
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Permisos Activos:</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  *ngFor="let perm of member.permisos"
                  class="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-600 text-[10px] font-medium"
                >
                  {{ perm.replace('_', ' ') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Registro de auditoría de seguridad -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 lg:p-6 shadow-xs">
        <div class="flex items-center justify-between pb-3.5 border-b border-gray-100">
          <div>
            <h2 class="text-sm font-bold text-gray-900">Registro de Auditoría y Actividad de Seguridad</h2>
            <p class="text-xs text-gray-500">Registro inmutable de alteraciones de inventario, despachos y eventos de acceso</p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">Flujo en Vivo</span>
        </div>

        <div class="divide-y divide-gray-100 mt-1">
          <div *ngFor="let log of teamService.auditLogs()" class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="flex items-start space-x-2.5">
              <span class="material-symbols-outlined text-[18px] text-indigo-600 mt-0.5">verified_user</span>
              <div>
                <span class="font-bold text-gray-900">{{ log.usuario }}</span>
                <span class="text-gray-400 mx-1.5">•</span>
                <span class="text-gray-600">{{ log.detalles }}</span>
              </div>
            </div>
            <div class="text-[11px] text-gray-400 shrink-0 font-medium">
              {{ log.timestamp }}
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class TeamComponent implements OnInit {
  constructor(public teamService: TeamService) {}

  ngOnInit() {
    this.teamService.loadTeam();
    this.teamService.loadAuditLog();
  }

  getRolBadgeClass(rol: string): string {
    const lower = rol.toLowerCase();
    if (lower.includes('admin')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (lower.includes('encargado') || lower.includes('sucursal')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (lower.includes('cajero')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (lower.includes('proveedor')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (lower.includes('cliente')) return 'bg-gray-100 text-gray-600 border-gray-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}
