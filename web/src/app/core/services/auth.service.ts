import { Injectable, signal } from '@angular/core';
import { AdminUser, UserRole } from '../models';
import { NotificationService } from './notification.service';

const DEMO_USERS: AdminUser[] = [
  {
    id: 'usr_01',
    name: 'Helena Vance',
    email: 'manager@aether.com',
    role: 'DIRECTOR',
    roleTitle: 'Global Operations Director',
    location: 'Paris 8e (Place Vendôme)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    lastActive: 'Just now',
    permissions: ['ALL_ACCESS', 'INVENTORY_ADJUST', 'DISPATCH_APPROVE', 'CATALOG_PUBLISH', 'SECURITY_AUDIT']
  },
  {
    id: 'usr_02',
    name: 'Kenji Takahashi',
    email: 'curator@aether.com',
    role: 'CURATOR',
    roleTitle: 'Chief Archive Curator & Garment Lead',
    location: 'Tokyo (Ginza Atelier)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    lastActive: '12m ago',
    permissions: ['CATALOG_EDIT', 'ARCHIVE_SPEC_WRITE', 'INVENTORY_VIEW']
  },
  {
    id: 'usr_03',
    name: 'Astrid Lindholm',
    email: 'logistics@aether.com',
    role: 'SUPPLY_CHAIN',
    roleTitle: 'Global Supply & Vault Manager',
    location: 'Milan / Zurich Vault',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    lastActive: '1h ago',
    permissions: ['INVENTORY_ADJUST', 'DISPATCH_CREATE', 'DISPATCH_APPROVE', 'TRANSFER_EXECUTE']
  }
];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSignal = signal<AdminUser | null>(DEMO_USERS[0]); // Default logged in for interactive exploration or login screen toggling
  private isAuthenticatedSignal = signal<boolean>(true);

  public currentUser = this.currentUserSignal.asReadonly();
  public isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  constructor(private notificationService: NotificationService) {}

  login(email: string, pass: string): boolean {
    if (!email) {
      this.notificationService.error('Authentication Error', 'Please enter a valid email address.');
      return false;
    }

    const matchedUser = DEMO_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || DEMO_USERS[0];
    this.currentUserSignal.set(matchedUser);
    this.isAuthenticatedSignal.set(true);
    this.notificationService.success('Access Granted', `Welcome back, ${matchedUser.name} (${matchedUser.roleTitle})`);
    return true;
  }

  quickSwitchUser(role: UserRole) {
    const user = DEMO_USERS.find(u => u.role === role) || DEMO_USERS[0];
    this.currentUserSignal.set(user);
    this.isAuthenticatedSignal.set(true);
    this.notificationService.info('Session Switched', `Active identity: ${user.name} — ${user.roleTitle}`);
  }

  logout() {
    this.currentUserSignal.set(null);
    this.isAuthenticatedSignal.set(false);
    this.notificationService.info('Logged Out', 'Your administrative session has ended securely.');
  }

  requestAccess(email: string, fullName: string, department: string, justification: string) {
    this.notificationService.success(
      'Request Submitted',
      `Access request for ${email} has been logged with Master Operations. Verification token sent.`
    );
  }

  resetPassword(email: string) {
    this.notificationService.info(
      'Recovery Link Dispatched',
      `Instructions for MFA credential reset dispatched to ${email || 'manager@aether.com'}.`
    );
  }
}
