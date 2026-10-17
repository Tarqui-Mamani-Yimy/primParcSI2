import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RevealOnScroll } from './reveal-on-scroll';

export interface BoutiqueNode {
  name: string;
  location: string;
  pieces: number;
  value: string;
  status: 'OPERATIVO' | 'EN RESERVA' | 'EN TRANSITO';
}

export interface CustodyLog {
  id: string;
  timeAgo: string;
  description: string;
  type: 'transfer' | 'reserve' | 'audit';
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RevealOnScroll],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  @Output() login = new EventEmitter<void>();

  // Dark Mode State
  darkMode = signal<boolean>(false);

  // Navigation & UI States
  mobileMenuOpen = signal<boolean>(false);
  activeSection = signal<string>('soluciones');

  // Dashboard state
  activeDashboardTab = signal<'ops' | 'inv' | 'vip'>('ops');

  // Billing cycle
  billingCycle = signal<'monthly' | 'annual'>('monthly');

  // Modals
  vaultModalOpen = signal<boolean>(false);
  historyModalOpen = signal<boolean>(false);
  formSubmitted = signal<boolean>(false);
  submittedData = signal<{ boutique: string; email: string } | null>(null);

  // Live Telemetry Auto-refresh timer
  lastRefreshedSeconds = signal<number>(3);
  private timerInterval?: ReturnType<typeof setInterval>;

  // Pricing calculations for 3 paid plans: Básico, Intermedio, Pro
  basicPrice = computed(() => (this.billingCycle() === 'monthly' ? '$290' : '$232'));
  basicPriceBs = computed(() =>
    this.billingCycle() === 'monthly' ? '2.000 Bs / mes' : '1.600 Bs / mes (Ahorro anual)'
  );

  intermediatePrice = computed(() => (this.billingCycle() === 'monthly' ? '$690' : '$552'));
  intermediatePriceBs = computed(() =>
    this.billingCycle() === 'monthly' ? '4.800 Bs / mes' : '3.840 Bs / mes (Ahorro anual)'
  );

  proPrice = computed(() => (this.billingCycle() === 'monthly' ? '$1.490' : '$1.192'));
  proPriceBs = computed(() =>
    this.billingCycle() === 'monthly' ? '10.400 Bs / mes' : '8.320 Bs / mes (Ahorro anual)'
  );

  // Boutiques table
  nodes: BoutiqueNode[] = [
    { name: 'Equipetrol Flagship', location: 'Santa Cruz • N-01', pieces: 74, value: '320.000 Bs', status: 'OPERATIVO' },
    { name: 'El Prado Atelier', location: 'La Paz • N-02', pieces: 52, value: '215.000 Bs', status: 'OPERATIVO' },
    { name: 'Zurich Vault Primary', location: 'Suiza • V-01', pieces: 38, value: '185.000 Bs', status: 'EN RESERVA' },
    { name: 'Ginza Pop-Up Node', location: 'Tokio • N-03', pieces: 16, value: '60.000 Bs', status: 'OPERATIVO' },
  ];

  // Custody log entries
  custodyLogs: CustodyLog[] = [
    { id: '#TRF-2940', timeAgo: 'HACE 4 MIN', description: 'Saco Lana Merino Despachado a Equipetrol', type: 'transfer' },
    { id: '#RSV-1102', timeAgo: 'HACE 19 MIN', description: 'Reserva VIP Confirmada (Suite Presidencial)', type: 'reserve' },
    { id: '#AUD-0091', timeAgo: 'HACE 42 MIN', description: 'Auditoría RFID Completada: Cero discrepancias', type: 'audit' },
  ];

  fullCustodyHistory: CustodyLog[] = [
    { id: '#TRF-2940', timeAgo: 'HACE 4 MIN', description: 'Saco Lana Merino Despachado a Equipetrol (Valija Blindada N-01)', type: 'transfer' },
    { id: '#RSV-1102', timeAgo: 'HACE 19 MIN', description: 'Reserva VIP Confirmada para Suite Presidencial Ginebra', type: 'reserve' },
    { id: '#AUD-0091', timeAgo: 'HACE 42 MIN', description: 'Auditoría RFID Bóveda Zúrich: 38 piezas conciliadas 100%', type: 'audit' },
    { id: '#TRF-2938', timeAgo: 'HACE 2 HORAS', description: 'Vestido Seda Cruda Calibre 18gg recibido en Atelier El Prado', type: 'transfer' },
    { id: '#SYN-0044', timeAgo: 'HACE 4 HORAS', description: 'Calibración biométrica y sincronización con Consulado Tokio', type: 'audit' },
    { id: '#RSV-1099', timeAgo: 'HACE 6 HORAS', description: 'Bloqueo exclusivo de Abrigo Cachemira Biella para cliente VIP-7701', type: 'reserve' }
  ];

  // Node Deployment Contact Form with Plan Selection
  deploymentForm = new FormGroup({
    boutiqueName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    selectedPlan: new FormControl('Plan Intermedio ($690/mes)', [Validators.required]),
    branches: new FormControl('1 a 3 Boutiques', [Validators.required]),
    garmentVolume: new FormControl('200 - 1.000 pzs', [Validators.required]),
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const savedTheme = localStorage.getItem('youshop-theme');
        const isDark = savedTheme === 'dark';
        this.darkMode.set(isDark);
        this.applyThemeClass(isDark);
      } catch {
        // Ignorar si localStorage no está disponible
      }
    }

    // Auto refresh ticker
    this.timerInterval = setInterval(() => {
      this.lastRefreshedSeconds.update((s) => (s > 1 ? s - 1 : 3));
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    // Limpieza de clases dark globales al salir de la landing para no alterar otras vistas
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }

  toggleDarkMode() {
    const nextMode = !this.darkMode();
    this.darkMode.set(nextMode);

    if (isPlatformBrowser(this.platformId)) {
      this.applyThemeClass(nextMode);
      try {
        localStorage.setItem('youshop-theme', nextMode ? 'dark' : 'light');
      } catch {
        // Ignorar
      }
    }
  }

  private applyThemeClass(isDark: boolean) {
    if (!isPlatformBrowser(this.platformId)) return;
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }

  setDashboardTab(tab: 'ops' | 'inv' | 'vip') {
    this.activeDashboardTab.set(tab);
  }

  setBillingCycle(cycle: 'monthly' | 'annual') {
    this.billingCycle.set(cycle);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  openVaultModal() {
    this.vaultModalOpen.set(true);
  }

  closeVaultModal() {
    this.vaultModalOpen.set(false);
  }

  openHistoryModal() {
    this.historyModalOpen.set(true);
  }

  closeHistoryModal() {
    this.historyModalOpen.set(false);
  }

  selectPlanAndScroll(planName: string) {
    this.deploymentForm.patchValue({ selectedPlan: planName });
    this.scrollToSection('demostracion');
  }

  onBuyOrSubscribe(planName: string) {
    this.closeMobileMenu();
    this.closeVaultModal();
    this.closeHistoryModal();
    this.login.emit();
  }

  onLogin() {
    this.closeMobileMenu();
    this.closeVaultModal();
    this.closeHistoryModal();
    this.login.emit();
  }

  onSubmitForm() {
    if (this.deploymentForm.valid) {
      const formVal = this.deploymentForm.value;
      this.submittedData.set({
        boutique: formVal.boutiqueName || 'Su Casa de Moda',
        email: formVal.email || 'correo@ejemplo.com',
      });
      this.formSubmitted.set(true);
      this.deploymentForm.reset({
        selectedPlan: 'Plan Intermedio ($690/mes)',
        branches: '1 a 3 Boutiques',
        garmentVolume: '200 - 1.000 pzs',
      });
    } else {
      this.deploymentForm.markAllAsTouched();
    }
  }

  resetFormStatus() {
    this.formSubmitted.set(false);
    this.submittedData.set(null);
  }

  scrollToSection(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    this.closeMobileMenu();
  }
}
