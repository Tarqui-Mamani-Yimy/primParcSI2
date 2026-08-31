import { Injectable, signal } from '@angular/core';
import { AdminUser, AuditLogEntry } from '../models';
import { NotificationService } from './notification.service';

const INITIAL_TEAM: AdminUser[] = [
  {
    id: 'usr_01',
    name: 'Helena Vance',
    email: 'manager@aether.com',
    role: 'DIRECTOR',
    roleTitle: 'Global Operations Director',
    location: 'Paris 8e Flagship',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    lastActive: 'Active now',
    permissions: ['ALL_ACCESS', 'SECURITY_ADMIN', 'INVENTORY_OVERRIDE', 'VIP_DISPATCH_AUTHORIZE']
  },
  {
    id: 'usr_02',
    name: 'Kenji Takahashi',
    email: 'curator@aether.com',
    role: 'CURATOR',
    roleTitle: 'Chief Archive Curator',
    location: 'Tokyo Ginza Atelier',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    lastActive: '14m ago',
    permissions: ['CATALOG_WRITE', 'FABRIC_SPEC_EDIT', 'ARCHIVE_VAULT_ACCESS']
  },
  {
    id: 'usr_03',
    name: 'Astrid Lindholm',
    email: 'logistics@aether.com',
    role: 'SUPPLY_CHAIN',
    roleTitle: 'Global Supply & Vault Manager',
    location: 'Alpine Central Vault Zurich',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    lastActive: '1h ago',
    permissions: ['STOCK_DISPATCH', 'HUB_TRANSFER_APPROVE', 'COURIER_BOOKING']
  },
  {
    id: 'usr_04',
    name: 'Marcus Sterling',
    email: 'marcus.s@aether.com',
    role: 'DIRECTOR',
    roleTitle: 'Director of Americas Operations',
    location: 'New York SoHo Salon',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    lastActive: '3h ago',
    permissions: ['STOCK_DISPATCH', 'VIP_DISPATCH_AUTHORIZE']
  }
];

const INITIAL_LOGS: AuditLogEntry[] = [
  { id: 'log_1', timestamp: '2026-08-26 20:45', user: 'Helena Vance', action: 'STOCK_TRANSFER', details: 'Authorized transfer of 6x Overcoats from Zurich to Paris Flagship', severity: 'INFO' },
  { id: 'log_2', timestamp: '2026-08-26 19:12', user: 'Astrid Lindholm', action: 'DISPATCH_BOOKED', details: 'Ferrari Luxury Secured shipment generated for VIP client Geneva', severity: 'INFO' },
  { id: 'log_3', timestamp: '2026-08-26 17:30', user: 'Kenji Takahashi', action: 'SPEC_UPDATE', details: 'Updated Mongolian Cashmere certification details for AETH-CT-001', severity: 'INFO' },
  { id: 'log_4', timestamp: '2026-08-26 14:02', user: 'SYSTEM_SECURITY', action: 'MFA_CHALLENGE', details: 'Biometric passkey verified for Director terminal PAR-08', severity: 'INFO' }
];

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private teamMembersSignal = signal<AdminUser[]>(INITIAL_TEAM);
  private auditLogsSignal = signal<AuditLogEntry[]>(INITIAL_LOGS);

  public teamMembers = this.teamMembersSignal.asReadonly();
  public auditLogs = this.auditLogsSignal.asReadonly();

  constructor(private notificationService: NotificationService) {}

  addMember(member: Omit<AdminUser, 'id' | 'lastActive'>) {
    const id = 'usr_' + Date.now().toString(36);
    const newMember: AdminUser = {
      ...member,
      id,
      lastActive: 'Invited (Pending MFA activation)'
    };
    this.teamMembersSignal.update(list => [...list, newMember]);
    this.notificationService.success('Personnel Enrolled', `Administrative credentials provisioned for ${member.email}`);
  }

  togglePermission(userId: string, permission: string) {
    this.teamMembersSignal.update(list =>
      list.map(u => {
        if (u.id === userId) {
          const has = u.permissions.includes(permission);
          const updatedPerms = has
            ? u.permissions.filter(p => p !== permission)
            : [...u.permissions, permission];
          return { ...u, permissions: updatedPerms };
        }
        return u;
      })
    );
    this.notificationService.info('Permissions Updated', `Security policy updated for user.`);
  }
}
