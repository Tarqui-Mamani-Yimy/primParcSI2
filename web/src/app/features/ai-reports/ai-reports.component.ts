import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AIReportOut,
  ReportsAiService,
  parseAiReportError,
  parseTranscribeError,
} from '../../core/services/reports-ai.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-ai-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-in fade-in duration-200">

      <!-- Encabezado de la Sección -->
      <div class="pb-5 border-b border-gray-200">
        <div class="flex items-center space-x-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#38133E]">
            Inteligencia Artificial · Gemini
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA] uppercase tracking-wider">
            Solo Administrador
          </span>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
          Reportes con Inteligencia Artificial
        </h2>
        <p class="text-xs text-gray-500 mt-1">
          Escribí o dictá por voz una consulta en lenguaje natural para obtener resúmenes ejecutivos y tablas estructuradas de tu negocio.
        </p>
      </div>

      <!-- Alerta si el rol no es Administrador -->
      <div *ngIf="!isAdmin()" class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center space-x-3">
        <span class="material-symbols-outlined text-[20px] text-amber-700">lock</span>
        <div>
          <p class="font-bold">Acceso Restringido</p>
          <p class="mt-0.5">Esta funcionalidad está reservada exclusivamente para usuarios con rol Administrador.</p>
        </div>
      </div>

      <!-- Zona de Consulta (Input + Voz + Chips) -->
      <div *ngIf="isAdmin()" class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
        
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Consulta en Lenguaje Natural *
            </label>

            <!-- Estado de compatibilidad de reconocimiento de voz -->
            <span *ngIf="!speechSupported()" class="text-[11px] text-gray-400 flex items-center space-x-1" title="El navegador actual no soporta dictado por voz">
              <span class="material-symbols-outlined text-[14px]">mic_off</span>
              <span>Dictado por voz no compatible en este navegador</span>
            </span>
          </div>

          <!-- Área de texto con control de voz -->
          <div class="relative">
            <textarea
              rows="3"
              [ngModel]="promptText()"
              (ngModelChange)="promptText.set($event)"
              placeholder="Ejemplo: 'Ventas por sucursal del último mes' o 'Prendas con stock bajo'…"
              class="w-full text-sm border border-gray-200 rounded-xl p-3 pr-14 bg-white focus:outline-none focus:ring-2 focus:ring-[#38133E] transition-all resize-none"
              [disabled]="loading() || isTranscribing()"
            ></textarea>

            <!-- Botón de Micrófono (Web Speech API o MediaRecorder) -->
            <div class="absolute right-3 top-3">
              <button
                type="button"
                *ngIf="speechSupported()"
                (click)="toggleVoiceInput()"
                [disabled]="loading() || isTranscribing()"
                [class.bg-rose-500]="isListening() || isRecording()"
                [class.text-white]="isListening() || isRecording()"
                [class.animate-pulse]="isListening() || isRecording()"
                [class.bg-gray-100]="!isListening() && !isRecording()"
                [class.text-gray-700]="!isListening() && !isRecording()"
                [class.hover:bg-gray-200]="!isListening() && !isRecording()"
                class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
                [title]="getVoiceButtonTitle()"
              >
                <span *ngIf="isTranscribing()" class="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
                <span *ngIf="!isTranscribing() && isRecording()" class="material-symbols-outlined text-[18px]">
                  stop
                </span>
                <span *ngIf="!isTranscribing() && isListening()" class="material-symbols-outlined text-[18px]">
                  mic
                </span>
                <span *ngIf="!isTranscribing() && !isRecording() && !isListening()" class="material-symbols-outlined text-[18px]">
                  mic_none
                </span>
              </button>
            </div>
          </div>

          <!-- Indicador visual cuando el micrófono está grabando (Web Speech API) -->
          <div *ngIf="isListening()" class="flex items-center space-x-2 text-xs text-rose-600 font-semibold animate-pulse">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
            <span>Escuchando dictado en español… Hablá ahora y detené el micrófono al terminar.</span>
          </div>

          <!-- Indicador visual cuando MediaRecorder está grabando (Firefox fallback) -->
          <div *ngIf="isRecording()" class="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs animate-pulse">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span class="font-semibold">Grabando… Hablá ahora y pulsá el botón para detener (corte automático a los 60 s).</span>
            </div>
            <button
              type="button"
              (click)="stopMediaRecording(true)"
              class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] uppercase tracking-wide flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
            >
              <span class="material-symbols-outlined text-[14px]">stop</span>
              <span>Detener</span>
            </button>
          </div>

          <!-- Indicador visual cuando se está transcribiendo el audio con Groq Whisper -->
          <div *ngIf="isTranscribing()" class="flex items-center space-x-2 text-xs text-[#38133E] font-semibold">
            <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            <span>Transcribiendo… Procesando audio con Inteligencia Artificial.</span>
          </div>
        </div>

        <!-- Chips de Consultas Sugeridas -->
        <div class="space-y-1.5 pt-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
            Consultas Sugeridas:
          </span>
          <div class="flex flex-wrap gap-2">
            <button
              *ngFor="let chip of suggestedChips"
              type="button"
              (click)="applyChip(chip)"
              [disabled]="loading()"
              class="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-[#F5EBF7] hover:border-[#38133E]/30 text-gray-700 hover:text-[#38133E] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {{ chip }}
            </button>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div class="flex items-center justify-between pt-2 border-t border-gray-100">
          <button
            type="button"
            (click)="limpiar()"
            [disabled]="loading() || isTranscribing() || (!promptText() && !reportResult())"
            class="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer disabled:opacity-30"
          >
            Limpiar
          </button>

          <button
            type="button"
            (click)="ejecutarConsulta()"
            [disabled]="loading() || isTranscribing() || !promptText().trim()"
            class="px-5 py-2.5 rounded-xl bg-[#38133E] hover:bg-[#260B2B] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span *ngIf="loading()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            <span *ngIf="!loading()" class="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>{{ loading() ? 'Analizando con IA…' : 'Consultar Reporte' }}</span>
          </button>
        </div>

      </div>

      <!-- Estado de Error / 503 Gemini no configurado -->
      <div *ngIf="errorMessage()" class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start space-x-3">
        <span class="material-symbols-outlined text-[20px] text-rose-600 shrink-0 mt-0.5">error</span>
        <div class="space-y-1">
          <p class="font-bold">No se pudo generar el reporte</p>
          <p class="leading-relaxed">{{ errorMessage() }}</p>
        </div>
      </div>

      <!-- Estado de Carga -->
      <div *ngIf="loading()" class="p-10 bg-white rounded-xl border border-gray-200 shadow-xs text-center space-y-3">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F5EBF7] text-[#38133E]">
          <span class="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-900">Gemini está procesando tu consulta…</h3>
          <p class="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Analizando los datos verificados del sistema para construir la síntesis y estructurar las columnas de resultados.
          </p>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- RESULTADOS DEL REPORTE IA (Resumen, Periodo, Tabla, CSV) -->
      <!-- ============================================================== -->
      <div *ngIf="!loading() && reportResult() as res" class="space-y-5 animate-in fade-in duration-200">

        <!-- Tarjeta de Resumen Ejecutivo -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
            <div class="flex items-center space-x-2">
              <span class="material-symbols-outlined text-[#38133E] text-[20px]">psychology</span>
              <h3 class="text-xs font-bold uppercase tracking-wider text-gray-800">
                Resumen Ejecutivo Generado por IA
              </h3>
            </div>

            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                Herramienta: {{ getToolBadgeLabel(res.tool_used) }}
              </span>
              <span class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#F5EBF7] text-[#38133E] border border-[#E8E2DA]">
                {{ formatPeriod(res.period) }}
              </span>
            </div>
          </div>

          <!-- Texto del Resumen -->
          <p class="text-sm text-gray-800 leading-relaxed font-medium">
            {{ res.summary }}
          </p>
        </div>

        <!-- Tabla Estructurada de Datos -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          
          <div class="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-800">
                Detalle Tabular de Datos
              </h4>
              <p class="text-[11px] text-gray-400 mt-0.5">
                Total de registros recuperados: {{ res.rows.length }}
              </p>
            </div>

            <!-- Botón Exportar CSV -->
            <button
              type="button"
              (click)="descargarCsv()"
              [disabled]="downloadingCsv()"
              class="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wide transition-colors flex items-center space-x-2 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <span *ngIf="downloadingCsv()" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span *ngIf="!downloadingCsv()" class="material-symbols-outlined text-[16px]">download</span>
              <span>{{ downloadingCsv() ? 'Descargando…' : 'Exportar CSV' }}</span>
            </button>
          </div>

          <!-- Tabla con columns y rows -->
          <div *ngIf="res.rows.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <th *ngFor="let col of res.columns" class="py-2.5 px-4 whitespace-nowrap">
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 text-xs">
                <tr *ngFor="let row of res.rows" class="hover:bg-gray-50/70 transition-colors">
                  <td *ngFor="let cell of row" class="py-2.5 px-4 text-gray-800">
                    {{ formatCell(cell) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Estado vacío si rows es 0 -->
          <div *ngIf="res.rows.length === 0" class="p-8 text-center text-xs text-gray-400 space-y-1">
            <span class="material-symbols-outlined text-[24px] text-gray-300">table_rows</span>
            <p>No se encontraron filas de datos para el período o filtros de esta consulta.</p>
          </div>
        </div>

      </div>

    </div>
  `
})
export class AiReportsComponent implements OnInit, OnDestroy {
  promptText = signal<string>('');
  loading = signal<boolean>(false);
  downloadingCsv = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  reportResult = signal<AIReportOut | null>(null);
  lastExecutedPrompt = signal<string>('');

  isListening = signal<boolean>(false);
  isRecording = signal<boolean>(false);
  isTranscribing = signal<boolean>(false);
  speechSupported = signal<boolean>(false);
  speechMode = signal<'native' | 'recorder' | 'none'>('none');

  private recognitionInstance: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private currentStream: MediaStream | null = null;
  private recordingTimeout: any = null;
  private shouldTranscribeAudio: boolean = true;

  suggestedChips: string[] = [
    'Ventas por sucursal del último mes',
    'Productos más vendidos recientemente',
    'Prendas con stock bajo en inventario',
    'Devoluciones y cambios de los últimos 30 días',
    'Ventas totales de este año'
  ];

  constructor(
    private reportsAiService: ReportsAiService,
    private authService: AuthService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    const mode = this.checkSpeechSupport();
    this.speechMode.set(mode);
    this.speechSupported.set(mode !== 'none');
  }

  ngOnDestroy(): void {
    this.stopAllVoiceInputs();
  }

  isAdmin(): boolean {
    const rol = this.authService.currentUser()?.rol;
    return rol === 'Administrador' || this.authService.isSuperAdmin();
  }

  getVoiceButtonTitle(): string {
    if (this.isTranscribing()) {
      return 'Transcribiendo audio…';
    }
    if (this.isRecording()) {
      return 'Detener grabación';
    }
    if (this.isListening()) {
      return 'Detener dictado por voz';
    }
    return this.speechMode() === 'recorder'
      ? 'Grabar consulta por voz (MediaRecorder)'
      : 'Dictar consulta por voz';
  }

  private checkSpeechSupport(): 'native' | 'recorder' | 'none' {
    if (typeof window === 'undefined') return 'none';
    if ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
      return 'native';
    }
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof (window as any).MediaRecorder !== 'undefined'
    ) {
      return 'recorder';
    }
    return 'none';
  }

  toggleVoiceInput(): void {
    if (this.isTranscribing() || this.loading()) {
      return;
    }

    if (this.speechMode() === 'native') {
      if (this.isListening()) {
        this.stopVoiceInput();
      } else {
        this.startVoiceInput();
      }
    } else if (this.speechMode() === 'recorder') {
      if (this.isRecording()) {
        this.stopMediaRecording(true);
      } else {
        this.startMediaRecording();
      }
    }
  }

  // =========================================================================
  // WEB SPEECH API (Chrome / WebKit nativo)
  // =========================================================================

  private startVoiceInput(): void {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.notificationService.warning(
        'Voz no compatible',
        'Tu navegador no soporta la Web Speech API para dictado.'
      );
      return;
    }

    try {
      this.recognitionInstance = new SpeechRecognitionClass();
      this.recognitionInstance.lang = 'es-ES';
      this.recognitionInstance.continuous = false;
      this.recognitionInstance.interimResults = false;

      this.recognitionInstance.onstart = () => {
        this.isListening.set(true);
      };

      this.recognitionInstance.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            const current = this.promptText().trim();
            this.promptText.set(current ? `${current} ${transcript}` : transcript);
            this.notificationService.info('Voz capturada', `"${transcript}"`);
          }
        }
      };

      this.recognitionInstance.onerror = (event: any) => {
        this.isListening.set(false);
        if (event.error !== 'no-speech') {
          this.notificationService.warning(
            'Dictado interrumpido',
            'No se pudo capturar el audio o se canceló el permiso del micrófono.'
          );
        }
      };

      this.recognitionInstance.onend = () => {
        this.isListening.set(false);
      };

      this.recognitionInstance.start();
    } catch {
      this.isListening.set(false);
      this.notificationService.error(
        'Micrófono no disponible',
        'No se pudo inicializar la grabación de voz en este navegador.'
      );
    }
  }

  private stopVoiceInput(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // Ignorar si ya fue detenido
      }
      this.recognitionInstance = null;
    }
    this.isListening.set(false);
  }

  // =========================================================================
  // MEDIARECORDER API (Firefox Fallback -> POST /api/reports/ai/transcribe)
  // =========================================================================

  private getPreferredMimeType(): string {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      return 'audio/ogg;codecs=opus';
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return 'audio/webm';
    }
    if (MediaRecorder.isTypeSupported('audio/ogg')) {
      return 'audio/ogg';
    }
    return '';
  }

  async startMediaRecording(): Promise<void> {
    if (this.isRecording() || this.isTranscribing() || this.loading()) {
      return;
    }

    this.errorMessage.set(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.currentStream = stream;
    } catch (err: any) {
      this.cleanupStream();
      this.isRecording.set(false);

      let msg = 'No se pudo acceder al micrófono. Verificá los permisos del navegador.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = 'Permiso de micrófono denegado. Habilitá el acceso al micrófono en la configuración de tu navegador.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        msg = 'No se detectó ningún micrófono conectado en tu dispositivo.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        msg = 'El micrófono ya está siendo utilizado por otra aplicación o pestaña.';
      }
      this.notificationService.error('Error de micrófono', msg);
      return;
    }

    const preferredMime = this.getPreferredMimeType();
    try {
      const options: MediaRecorderOptions = preferredMime ? { mimeType: preferredMime } : {};
      this.mediaRecorder = new MediaRecorder(this.currentStream, options);
    } catch {
      try {
        this.mediaRecorder = new MediaRecorder(this.currentStream);
      } catch {
        this.cleanupStream();
        this.isRecording.set(false);
        this.notificationService.error(
          'Grabación no disponible',
          'No se pudo inicializar MediaRecorder en este navegador.'
        );
        return;
      }
    }

    this.recordedChunks = [];
    this.shouldTranscribeAudio = true;

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = () => {
      this.stopMediaRecording(false);
      this.notificationService.error(
        'Error de grabación',
        'Ocurrió un error inesperado al capturar el audio.'
      );
    };

    this.mediaRecorder.onstop = async () => {
      this.cleanupStream();
      this.clearRecordingTimeout();
      this.isRecording.set(false);

      if (!this.shouldTranscribeAudio || this.recordedChunks.length === 0) {
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.shouldTranscribeAudio = true;
        return;
      }

      const mime = preferredMime || this.mediaRecorder?.mimeType || 'audio/webm';
      const audioBlob = new Blob(this.recordedChunks, { type: mime });
      this.recordedChunks = [];
      this.mediaRecorder = null;
      this.shouldTranscribeAudio = true;

      await this.enviarAudioATranscribir(audioBlob);
    };

    try {
      this.mediaRecorder.start();
      this.isRecording.set(true);
    } catch {
      this.cleanupStream();
      this.isRecording.set(false);
      this.notificationService.error(
        'Error al iniciar grabación',
        'No se pudo comenzar a capturar audio del micrófono.'
      );
      return;
    }

    // Corte automático tras 60 segundos (S10)
    this.clearRecordingTimeout();
    this.recordingTimeout = setTimeout(() => {
      if (this.isRecording()) {
        this.stopMediaRecording(true);
        this.notificationService.info(
          'Límite de tiempo alcanzado',
          'La grabación se detuvo automáticamente a los 60 segundos.'
        );
      }
    }, 60000);
  }

  stopMediaRecording(shouldTranscribe: boolean = true): void {
    this.clearRecordingTimeout();
    if (!shouldTranscribe) {
      this.shouldTranscribeAudio = false;
      this.recordedChunks = [];
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanupStream();
        this.isRecording.set(false);
      }
    } else {
      this.cleanupStream();
      this.isRecording.set(false);
    }
  }

  private cleanupStream(): void {
    if (this.currentStream) {
      try {
        this.currentStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignorar si ya fueron detenidos
      }
      this.currentStream = null;
    }
  }

  private clearRecordingTimeout(): void {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
  }

  private async enviarAudioATranscribir(audioBlob: Blob): Promise<void> {
    if (audioBlob.size < 100) {
      this.notificationService.warning(
        'Audio vacío',
        'La grabación fue muy breve o no contiene audio suficiente.'
      );
      return;
    }

    if (audioBlob.size > 10 * 1024 * 1024) {
      this.notificationService.error(
        'Audio demasiado grande',
        'El audio grabado supera el límite máximo permitido (10 MB).'
      );
      return;
    }

    this.isTranscribing.set(true);
    try {
      const res = await this.reportsAiService.transcribeAudio(audioBlob);
      if (res && res.text && res.text.trim()) {
        const current = this.promptText().trim();
        const transcript = res.text.trim();
        this.promptText.set(current ? `${current} ${transcript}` : transcript);
        this.notificationService.success('Voz capturada', `"${transcript}"`);
      } else {
        this.notificationService.warning(
          'Sin texto detectado',
          'No se pudo transcribir texto del audio grabado. Intentá hablar más cerca del micrófono.'
        );
      }
    } catch (err: unknown) {
      const msg = parseTranscribeError(err);
      this.notificationService.error('Error al transcribir audio', msg);
    } finally {
      this.isTranscribing.set(false);
    }
  }

  private stopAllVoiceInputs(): void {
    this.stopVoiceInput();
    this.stopMediaRecording(false);
    this.cleanupStream();
    this.clearRecordingTimeout();
  }

  applyChip(chip: string): void {
    this.promptText.set(chip);
    this.errorMessage.set(null);
  }

  limpiar(): void {
    this.promptText.set('');
    this.errorMessage.set(null);
    this.reportResult.set(null);
    this.lastExecutedPrompt.set('');
    this.stopAllVoiceInputs();
  }

  async ejecutarConsulta(): Promise<void> {
    const query = this.promptText().trim();
    if (!query) {
      this.errorMessage.set('Por favor, ingresá una consulta antes de continuar.');
      return;
    }

    this.stopAllVoiceInputs();
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.reportsAiService.generateReport(query);
      this.reportResult.set(result);
      this.lastExecutedPrompt.set(query);
    } catch (err) {
      const msg = parseAiReportError(err);
      this.errorMessage.set(msg);
      this.notificationService.error('Error al generar reporte con IA', msg);
    } finally {
      this.loading.set(false);
    }
  }

  async descargarCsv(): Promise<void> {
    const prompt = this.lastExecutedPrompt() || this.promptText().trim();
    if (!prompt) return;

    this.downloadingCsv.set(true);
    try {
      const blob = await this.reportsAiService.downloadReportCsv(prompt);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte_ia_${Date.now()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      this.notificationService.success('Descarga iniciada', 'El archivo CSV fue descargado con éxito.');
    } catch (err) {
      const msg = parseAiReportError(err);
      this.notificationService.error('Error al exportar CSV', msg);
    } finally {
      this.downloadingCsv.set(false);
    }
  }

  // =========================================================================
  // HELPERS DE FORMATO (Sin regex inline en templates)
  // =========================================================================

  formatCell(value: any): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (typeof value === 'number') {
      return value.toLocaleString('es-BO');
    }
    return String(value);
  }

  formatPeriod(period: any): string {
    if (!period) {
      return 'Período completo';
    }
    if (typeof period === 'string') {
      return period;
    }
    if (typeof period === 'object') {
      const from = period.from || period.start || period.start_date;
      const to = period.to || period.end || period.end_date;
      if (from && to) {
        return `Período: ${from} al ${to}`;
      }
      if (from) {
        return `Desde ${from}`;
      }
      if (to) {
        return `Hasta ${to}`;
      }
    }
    return 'Período indicado en consulta';
  }

  getToolBadgeLabel(toolKey: string): string {
    switch (toolKey) {
      case 'sales_by_period':
        return 'Ventas por Período';
      case 'low_stock':
        return 'Stock Bajo';
      case 'top_products':
        return 'Top Productos';
      case 'returns':
        return 'Devoluciones y Cambios';
      default:
        return toolKey || 'Consulta Analítica';
    }
  }
}
