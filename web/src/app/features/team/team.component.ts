import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamService } from '../../core/services/team.service';
import { AdminUser, UserRole } from '../../core/models';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Security Governance & Multi-Node RBAC
          </span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
            Personnel Directory & Access Nodes
          </h1>
          <p class="text-xs text-gray-500 mt-1">
            Fine-grained role permissions, biometric MFA logs, and administrative node authorization.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="openInviteModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">person_add</span>
            <span>Provision Administrator</span>
          </button>
        </div>
      </div>

      <!-- Personnel Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          *ngFor="let member of teamService.teamMembers()"
          class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs hover:border-gray-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="flex items-start justify-between mb-3.5">
              <div class="flex items-center space-x-3">
                <img
                  [src]="member.avatarUrl"
                  [alt]="member.name"
                  class="w-10 h-10 rounded-full object-cover border border-gray-200 bg-gray-100"
                />
                <div>
                  <h3 class="text-sm font-bold text-gray-900">
                    {{ member.name }}
                  </h3>
                  <p class="text-xs text-gray-500 truncate max-w-[140px]">
                    {{ member.email }}
                  </p>
                </div>
              </div>

              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                [ngClass]="{
                  'bg-indigo-50 text-indigo-700 border-indigo-200': member.role === 'DIRECTOR',
                  'bg-amber-50 text-amber-700 border-amber-200': member.role === 'CURATOR',
                  'bg-sky-50 text-sky-700 border-sky-200': member.role === 'SUPPLY_CHAIN'
                }"
              >
                {{ member.role }}
              </span>
            </div>

            <p class="text-xs font-bold text-gray-900">
              {{ member.roleTitle }}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">
              Node: {{ member.location }}
            </p>

            <!-- Permissions Tags -->
            <div class="mt-3.5 pt-3 border-t border-gray-100">
              <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Active Privileges:
              </p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  *ngFor="let perm of member.permissions"
                  class="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-600 text-[10px] font-medium"
                >
                  {{ perm.replace('_', ' ') }}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span class="text-gray-500 text-[11px]">Status: {{ member.lastActive }}</span>
            <span class="text-emerald-700 font-bold text-[11px] flex items-center space-x-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>MFA Validated</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Security Audit Trail -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 lg:p-6 shadow-xs">
        <div class="flex items-center justify-between pb-3.5 border-b border-gray-100">
          <div>
            <h2 class="text-sm font-bold text-gray-900">
              Security Audit & Activity Ledger
            </h2>
            <p class="text-xs text-gray-500">Immutable register of inventory alterations, dispatches, and passkey verifications</p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
            Live Stream
          </span>
        </div>

        <div class="divide-y divide-gray-100 mt-1">
          <div *ngFor="let log of teamService.auditLogs()" class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div class="flex items-start space-x-2.5">
              <span class="material-symbols-outlined text-[18px] text-indigo-600 mt-0.5">verified_user</span>
              <div>
                <span class="font-bold text-gray-900">{{ log.user }}</span>
                <span class="text-gray-400 mx-1.5">•</span>
                <span class="text-gray-600">{{ log.details }}</span>
              </div>
            </div>
            <div class="text-[11px] text-gray-400 shrink-0 font-medium">
              {{ log.timestamp }}
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Provision Personnel Modal -->
    <div *ngIf="showInviteModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 relative">
        <button (click)="showInviteModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">RBAC Enrollment</span>
          <h2 class="text-lg font-bold text-gray-900 mt-0.5">Enroll Administrator</h2>
          <p class="text-xs text-gray-500">Provision a cryptographic identity for boutique or vault access.</p>
        </div>

        <form (ngSubmit)="submitNewMember()" class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Full Name</label>
            <input type="text" [(ngModel)]="newMemName" name="name" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Celine Laurent" />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Corporate Email</label>
            <input type="email" [(ngModel)]="newMemEmail" name="email" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="celine.l@aether.com" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Role Tier</label>
              <select [(ngModel)]="newMemRole" name="role" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="DIRECTOR">Director</option>
                <option value="CURATOR">Archive Curator</option>
                <option value="SUPPLY_CHAIN">Supply Chain Lead</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Hub Node</label>
              <select [(ngModel)]="newMemHub" name="hub" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="Paris 8e Flagship">Paris 8e Flagship</option>
                <option value="Tokyo Ginza Atelier">Tokyo Ginza Atelier</option>
                <option value="New York SoHo">New York SoHo</option>
                <option value="Milan Montenapoleone">Milan Montenapoleone</option>
                <option value="Zurich Central Vault">Zurich Central Vault</option>
              </select>
            </div>
          </div>

          <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs mt-4">
            Issue Credentials & Provision Passkey
          </button>
        </form>
      </div>
    </div>
  `
})
export class TeamComponent {
  showInviteModal = signal<boolean>(false);

  newMemName = '';
  newMemEmail = '';
  newMemRole: UserRole = 'DIRECTOR';
  newMemHub = 'Paris 8e Flagship';

  constructor(public teamService: TeamService) {}

  openInviteModal() {
    this.showInviteModal.set(true);
  }

  submitNewMember() {
    if (!this.newMemName || !this.newMemEmail) return;

    this.teamService.addMember({
      name: this.newMemName,
      email: this.newMemEmail,
      role: this.newMemRole,
      roleTitle: this.newMemRole === 'DIRECTOR' ? 'Regional Boutique Director' : this.newMemRole === 'CURATOR' ? 'Atelier Fabric Specialist' : 'Logistics Officer',
      location: this.newMemHub,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      permissions: ['INVENTORY_ADJUST', 'STOCK_DISPATCH']
    });

    this.showInviteModal.set(false);
  }
}
