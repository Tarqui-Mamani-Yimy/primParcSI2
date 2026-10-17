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
import { BillingService } from '../../core/services/billing.service';
import { BillingCycle, PublicPlan } from '../../core/models';

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
  private readonly billingService = inject(BillingService);

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
  signupModalOpen = signal<boolean>(false);
  formSubmitted = signal<boolean>(false);
  submittedData = signal<{ boutique: string; email: string } | null>(null);

  // Signup State
  selectedPlanCode = signal<'basico' | 'intermedio' | 'avanzado'>('basico');
  signupCiclo = signal<BillingCycle>('mensual');
  isSubmittingSignup = signal<boolean>(false);
  signupError = signal<string | null>(null);

  signupForm = new FormGroup({
    empresa: new FormControl('', [Validators.required, Validators.minLength(2)]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    correo: new FormControl('', [Validators.required, Validators.email]),
  });

  // Live Telemetry Auto-refresh timer
  lastRefreshedSeconds = signal<number>(3);
  private timerInterval?: ReturnType<typeof setInterval>;

  // Public plans from backend with decided fallbacks
  publicPlans = signal<PublicPlan[]>([
    { codigo: 'basico', nombre: 'Básico', precioMensual: 290, precioAnual: 2784, features: [], limites: { sucursales: 1, usuarios: 3, productos: 200 } },
    { codigo: 'intermedio', nombre: 'Intermedio', precioMensual: 690, precioAnual: 6624, features: [], limites: { sucursales: 5, usuarios: 15, productos: 2000 } },
    { codigo: 'avanzado', nombre: 'Avanzado', precioMensual: 1490, precioAnual: 14304, features: [], limites: { sucursales: null, usuarios: null, productos: null } },
  ]);

  getPlan(codigo: string): { monthly: number; annual: number; annualPerMonth: number } {
    const p = this.publicPlans().find((item) => item.codigo === codigo);
    if (p) {
      return {
        monthly: p.precioMensual,
        annual: p.precioAnual,
        annualPerMonth: Math.round(p.precioAnual / 12),
      };
    }
    if (codigo === 'intermedio') return { monthly: 690, annual: 6624, annualPerMonth: 552 };
    if (codigo === 'avanzado') return { monthly: 1490, annual: 14304, annualPerMonth: 1192 };
    return { monthly: 290, annual: 2784, annualPerMonth: 232 };
  }

  // Pricing calculations for 3 paid plans: Básico, Intermedio, Avanzado
  basicPrice = computed(() => {
    const p = this.getPlan('basico');
    return this.billingCycle() === 'monthly' ? `$${p.monthly}` : `$${p.annualPerMonth}`;
  });
  basicPriceBs = computed(() =>
    this.billingCycle() === 'monthly' ? '2.000 Bs / mes' : '1.600 Bs / mes (Ahorro anual)'
  );

  intermediatePrice = computed(() => {
    const p = this.getPlan('intermedio');
    return this.billingCycle() === 'monthly' ? `$${p.monthly}` : `$${p.annualPerMonth}`;
  });
  intermediatePriceBs = computed(() =>
    this.billingCycle() === 'monthly' ? '4.800 Bs / mes' : '3.840 Bs / mes (Ahorro anual)'
  );

  avanzadoPrice = computed(() => {
    const p = this.getPlan('avanzado');
    const val = this.billingCycle() === 'monthly' ? p.monthly : p.annualPerMonth;
    return `$${val >= 1000 ? val.toLocaleString('es-ES') : val}`;
  });
  avanzadoPriceBs = computed(() =>
    this.billingCycle() === 'monthly' ? '10.400 Bs / mes' : '8.320 Bs / mes (Ahorro anual)'
  );

  // Backward-compatibility aliases
  proPrice = this.avanzadoPrice;
  proPriceBs = this.avanzadoPriceBs;

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

    // Load public plans from backend
    this.billingService.getPublicPlans().subscribe({
      next: (plans) => {
        if (plans && plans.length > 0) {
          this.publicPlans.set(plans);
        }
      },
      error: () => {
        // Keep fallbacks
      },
    });

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

  openSignupModal(codigo: 'basico' | 'intermedio' | 'avanzado') {
    this.selectedPlanCode.set(codigo);
    this.signupCiclo.set(this.billingCycle() === 'annual' ? 'anual' : 'mensual');
    this.signupError.set(null);
    this.signupForm.reset();
    this.signupModalOpen.set(true);
  }

  closeSignupModal() {
    this.signupModalOpen.set(false);
    this.signupError.set(null);
  }

  setSignupCiclo(ciclo: BillingCycle) {
    this.signupCiclo.set(ciclo);
  }

  getSelectedPlanSummary() {
    const codigo = this.selectedPlanCode();
    const p = this.getPlan(codigo);
    const nombre = codigo === 'basico' ? 'Plan Básico' : (codigo === 'intermedio' ? 'Plan Intermedio' : 'Plan Avanzado');
    return {
      codigo,
      nombre,
      monthly: p.monthly,
      annual: p.annual,
      annualPerMonth: p.annualPerMonth,
    };
  }

  submitSignup() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    const val = this.signupForm.value;
    const codigo = this.selectedPlanCode();
    const ciclo = this.signupCiclo();

    this.isSubmittingSignup.set(true);
    this.signupError.set(null);

    this.billingService.publicSignup({
      empresa: (val.empresa || '').trim(),
      nombre: (val.nombre || '').trim(),
      correo: (val.correo || '').trim().toLowerCase(),
      codigoPlan: codigo,
      ciclo: ciclo,
    }).subscribe({
      next: (res) => {
        if (res.url) {
          window.location.href = res.url;
        } else {
          this.isSubmittingSignup.set(false);
          this.signupError.set('No se recibió la dirección de pago de Stripe.');
        }
      },
      error: (err) => {
        this.isSubmittingSignup.set(false);
        const code = err.error?.detail?.code;
        if (code === 'email_in_use') {
          this.signupError.set('Este correo ya está registrado en la plataforma. Inicia sesión o utiliza otro correo electrónico.');
        } else if (code === 'invalid_plan') {
          this.signupError.set('El plan seleccionado no es válido.');
        } else if (code === 'too_many_requests' || err.status === 429) {
          this.signupError.set('Demasiadas solicitudes. Por favor, intenta de nuevo en unos minutos.');
        } else if (code === 'stripe_not_configured' || err.status === 503) {
          this.signupError.set('El servicio de facturación no se encuentra disponible temporalmente. Contacta a soporte.');
        } else {
          const detail = err.error?.detail;
          const msg = typeof detail === 'string' ? detail : 'No se pudo iniciar el proceso de compra. Por favor intenta nuevamente.';
          this.signupError.set(msg);
        }
      },
    });
  }

  selectPlanAndScroll(planName: string) {
    this.deploymentForm.patchValue({ selectedPlan: planName });
    this.scrollToSection('demostracion');
  }

  onBuyOrSubscribe(planName: string) {
    if (planName.includes('Básico') || planName.includes('Basico')) {
      this.openSignupModal('basico');
    } else if (planName.includes('Intermedio')) {
      this.openSignupModal('intermedio');
    } else {
      this.openSignupModal('avanzado');
    }
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
