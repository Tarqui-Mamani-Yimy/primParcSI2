import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="flex w-full h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">

      <!-- Left Panel: Brand Introduction (Hidden on Mobile) -->
      <section class="hidden md:flex md:w-5/12 lg:w-1/2 bg-gray-900 relative flex-col justify-between p-10 lg:p-14 overflow-hidden">
        <div class="absolute inset-0 z-0 pointer-events-none">
          <img
            alt="AETHER Operations Architecture"
            class="w-full h-full object-cover opacity-25 mix-blend-luminosity scale-105"
            src="https://images.unsplash.com/photo-1544441893-675973e31985?w=1600&auto=format&fit=crop&q=80"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/80 to-gray-900/95"></div>
        </div>

        <div class="relative z-10">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
              A
            </div>
            <div>
              <span class="text-2xl font-bold text-white tracking-tight block">AETHER</span>
              <span class="text-xs uppercase tracking-widest text-indigo-300 font-semibold">Operations Node</span>
            </div>
          </div>
        </div>

        <div class="relative z-10 max-w-md">
          <div class="inline-block px-3 py-1 mb-4 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-200 text-xs font-bold tracking-wide uppercase">
            Release 2026.4
          </div>
          <h1 class="text-2xl lg:text-3xl font-bold leading-snug text-white mb-3 tracking-tight">
            Management Excellence for Essential Wear
          </h1>
          <p class="text-sm text-gray-300 leading-relaxed">
            Secure administrative access to the AETHER archive, operations platform, and global boutique inventory network.
          </p>

          <div class="mt-8 pt-6 border-t border-gray-800">
            <p class="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">Fast Demo Identities:</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                (click)="selectDemoPersona('manager@aether.com', 'admin')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Admin (Helena)</span>
              </button>
              <button
                type="button"
                (click)="selectDemoPersona('curator@aether.com', 'vendedor')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Vendedor (Kenji)</span>
              </button>
              <button
                type="button"
                (click)="selectDemoPersona('logistics@aether.com', 'admin')"
                class="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-xs font-medium text-white transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Logistics (Astrid)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Right Panel: Login Interface -->
      <section class="w-full md:w-7/12 lg:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16 bg-gray-50 relative">
        <div class="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl border border-gray-200 shadow-sm relative z-10">

          <div class="md:hidden flex flex-col items-center justify-center mb-6">
            <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md mb-2">A</div>
            <span class="text-xl font-bold text-gray-900 tracking-tight">AETHER</span>
            <span class="text-xs tracking-wider text-gray-500 uppercase">Operations & Archive Node</span>
          </div>

          <div class="text-center mb-8">
            <h2 class="text-xl font-bold text-gray-900">Admin Access</h2>
            <p class="text-xs text-gray-500 mt-1">Authenticate with your corporate credentials</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="flex flex-col space-y-5">
            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                [(ngModel)]="email"
                required
                placeholder="manager@aether.com"
                class="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div class="flex flex-col space-y-1.5">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wider" for="password">Password</label>
              <div class="relative">
                <input
                  id="password"
                  name="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  required
                  placeholder="••••••••"
                  class="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all pr-10"
                />
                <button
                  type="button"
                  (click)="togglePasswordVisibility()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  <span class="material-symbols-outlined text-[18px]">{{ showPassword() ? 'visibility' : 'visibility_off' }}</span>
                </button>
              </div>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                [disabled]="isLoading()"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <span *ngIf="isLoading()" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ isLoading() ? 'AUTHENTICATING...' : 'SIGN IN' }}</span>
              </button>
            </div>

            <div class="flex justify-between items-center pt-2">
              <button type="button" (click)="openForgotPassword()" class="text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer">
                Forgot Password?
              </button>
              <button type="button" (click)="openRequestAccess()" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
                Request Access
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>

    <!-- Forgot Password Modal -->
    <div *ngIf="showForgotModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-md w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xl relative">
        <button (click)="showForgotModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="mb-5">
          <span class="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">Security Recovery</span>
          <h3 class="text-lg font-bold text-gray-900 mt-1">Reset Password</h3>
          <p class="text-xs text-gray-500 mt-1">Provide your verified email to receive a reset link.</p>
        </div>
        <div class="space-y-4">
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Registered Email</label>
            <input type="email" [(ngModel)]="recoveryEmail" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="manager@aether.com" />
          </div>
          <button (click)="sendPasswordRecovery()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs">
            Send Secure Link
          </button>
        </div>
      </div>
    </div>

    <!-- Request Access Modal -->
    <div *ngIf="showRequestModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-lg w-full p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button (click)="showRequestModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="mb-5">
          <span class="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">Personnel Provisioning</span>
          <h3 class="text-lg font-bold text-gray-900 mt-1">Request Access</h3>
          <p class="text-xs text-gray-500 mt-1">Applications are reviewed by the Global Operations Director.</p>
        </div>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Full Name</label>
              <input type="text" [(ngModel)]="reqName" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Marc Dubois" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Corporate Email</label>
              <input type="email" [(ngModel)]="reqEmail" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="marc.d@aether.com" />
            </div>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Department</label>
            <select [(ngModel)]="reqHub" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option value="ventas">Ventas</option>
              <option value="logistica">Logística</option>
              <option value="inventario">Inventario</option>
              <option value="admin">Administración</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Justification for Access</label>
            <textarea [(ngModel)]="reqReason" rows="3" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Assigned to boutique restocking operations."></textarea>
          </div>
          <button (click)="submitAccessRequest()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs">
            Submit Application
          </button>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  @Output() loggedIn = new EventEmitter<void>();

  email = '';
  password = '';
  showPassword = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  showForgotModal = signal<boolean>(false);
  showRequestModal = signal<boolean>(false);

  recoveryEmail = '';
  reqName = '';
  reqEmail = '';
  reqHub = 'ventas';
  reqReason = '';

  constructor(private authService: AuthService) {}

  togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  selectDemoPersona(email: string, _role: UserRole) {
    this.email = email;
    this.password = 'demo1234';
    this.onSubmit();
  }

  onSubmit() {
    this.isLoading.set(true);
    this.authService.login(this.email, this.password).then((ok) => {
      this.isLoading.set(false);
      if (ok) {
        this.loggedIn.emit();
      }
    });
  }

  openForgotPassword() {
    this.showForgotModal.set(true);
  }

  sendPasswordRecovery() {
    this.authService.resetPassword(this.recoveryEmail);
    this.showForgotModal.set(false);
  }

  openRequestAccess() {
    this.showRequestModal.set(true);
  }

  submitAccessRequest() {
    this.authService.requestAccess(this.reqEmail || 'staff@aether.com', this.reqName, this.reqHub, this.reqReason);
    this.showRequestModal.set(false);
  }
}
