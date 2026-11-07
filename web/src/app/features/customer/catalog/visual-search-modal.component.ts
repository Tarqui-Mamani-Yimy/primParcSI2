import { Component, EventEmitter, OnDestroy, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VisualSearchService } from '../../../core/services/visual-search.service';
import { VisualSearchResultItem } from '../../../core/models';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Component({
  selector: 'app-visual-search-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150"
      (click)="onBackdropClick($event)"
    >
      <div
        class="bg-white max-w-4xl w-full rounded-2xl border border-[#E8E2DA] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col relative"
        (click)="$event.stopPropagation()"
      >
        <!-- Encabezado del modal -->
        <div class="p-5 sm:p-6 border-b border-[#E8E2DA] flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#F5EBF7] flex items-center justify-center text-[#38133E] shrink-0">
              <span class="material-symbols-outlined text-[24px]">photo_camera</span>
            </div>
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#38133E]">Inteligencia Visual</span>
              <h2 class="text-xl font-bold text-[#17141A] tracking-tight">Buscar Prendas por Foto</h2>
            </div>
          </div>
          <button
            type="button"
            (click)="cerrar.emit()"
            class="w-8 h-8 rounded-full bg-[#FAF8F5] text-[#5A5561] flex items-center justify-center hover:bg-[#38133E] hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal de búsqueda visual"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <!-- Inputs ocultos para subida de archivo y captura de cámara (S8) -->
        <input
          #fileInput
          type="file"
          accept="image/*"
          (change)="onFileInputChange($event)"
          class="hidden"
        />
        <input
          #cameraInput
          type="file"
          accept="image/*"
          capture
          (change)="onFileInputChange($event)"
          class="hidden"
        />

        <!-- Contenido desplazable -->
        <div class="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAF8F5]/50">

          <!-- Zona de Carga / Selección de Foto -->
          <div
            *ngIf="!previewUrl()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)"
            [ngClass]="{
              'border-[#38133E] bg-[#F5EBF7]/40': isDragging(),
              'border-[#E8E2DA] bg-white hover:border-[#38133E]/50': !isDragging()
            }"
            class="border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all flex flex-col items-center justify-center cursor-pointer shadow-xs"
            (click)="fileInput.click()"
          >
            <div class="w-14 h-14 rounded-full bg-[#F5EBF7] text-[#38133E] flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[30px]">add_photo_alternate</span>
            </div>
            <h3 class="text-sm font-bold text-[#17141A]">Arrastrá tu foto aquí o elegí una opción</h3>
            <p class="text-xs text-[#5A5561] mt-1 max-w-md">
              Buscamos en el catálogo las prendas con mayor parecido visual y disponibilidad inmediata de stock.
            </p>
            <p class="text-[11px] text-[#9B94A3] mt-1">Formatos admitidos: JPG, PNG, WEBP (máx. 5 MB)</p>

            <div class="flex flex-wrap items-center justify-center gap-3 mt-5" (click)="$event.stopPropagation()">
              <button
                type="button"
                (click)="fileInput.click()"
                class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[18px]">upload_file</span>
                <span>Subir archivo</span>
              </button>
              <button
                type="button"
                (click)="cameraInput.click()"
                class="px-4 py-2 bg-white border border-[#38133E] text-[#38133E] hover:bg-[#F5EBF7] rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[18px]">photo_camera</span>
                <span>Tomar foto con cámara</span>
              </button>
            </div>
          </div>

          <!-- Barra de Previsualización de la Foto Seleccionada -->
          <div
            *ngIf="previewUrl()"
            class="bg-white border border-[#E8E2DA] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-[#E8E2DA] shrink-0">
                <img [src]="previewUrl()" alt="Foto a buscar" class="w-full h-full object-cover" />
              </div>
              <div class="truncate">
                <p class="text-xs font-bold text-[#17141A] truncate">{{ selectedFileName() || 'Foto seleccionada' }}</p>
                <p class="text-[11px] text-[#5A5561]">{{ selectedFileSize() }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="fileInput.click()"
                [disabled]="loading()"
                class="px-3 py-1.5 bg-[#FAF8F5] border border-[#E8E2DA] text-[#17141A] hover:bg-[#F5EBF7] rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                <span>Cambiar imagen</span>
              </button>
              <button
                type="button"
                (click)="cameraInput.click()"
                [disabled]="loading()"
                class="px-3 py-1.5 bg-[#FAF8F5] border border-[#E8E2DA] text-[#17141A] hover:bg-[#F5EBF7] rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>Cámara</span>
              </button>
              <button
                type="button"
                (click)="resetSelection()"
                [disabled]="loading()"
                class="px-2.5 py-1.5 text-[#5A5561] hover:text-rose-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                title="Quitar foto"
              >
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>

          <!-- Mensaje de Error (Validación o Servidor) -->
          <div
            *ngIf="errorMessage()"
            class="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-2.5 text-xs animate-in fade-in duration-150"
          >
            <span class="material-symbols-outlined text-rose-600 text-[18px] shrink-0 mt-0.5">error</span>
            <div class="flex-1">
              <p class="font-bold">No se pudo realizar la búsqueda</p>
              <p class="mt-0.5">{{ errorMessage() }}</p>
            </div>
            <button
              type="button"
              (click)="errorMessage.set(null)"
              class="text-rose-600 hover:text-rose-900 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <!-- Estado de Carga (Loading) -->
          <div *ngIf="loading()" class="py-16 text-center space-y-3">
            <div class="inline-block animate-spin text-[#38133E]">
              <span class="material-symbols-outlined text-[36px]">progress_activity</span>
            </div>
            <p class="text-sm font-bold text-[#17141A]">Analizando imagen con IA y buscando similitudes…</p>
            <p class="text-xs text-[#5A5561]">Calculando los vectores de características visuales contra el catálogo.</p>
          </div>

          <!-- Resultados y Estados Vacíos (cuando ya se buscó y no está cargando) -->
          <div *ngIf="!loading() && searched()">

            <!-- Caso 1: Catálogo sin imágenes indexadas (indexados === 0) -->
            <div
              *ngIf="indexados() === 0"
              class="bg-white border border-[#E8E2DA] rounded-2xl p-10 text-center space-y-3"
            >
              <div class="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <span class="material-symbols-outlined text-[30px]">database_off</span>
              </div>
              <h3 class="text-base font-bold text-[#17141A]">El catálogo aún no tiene imágenes indexadas</h3>
              <p class="text-xs text-[#5A5561] max-w-md mx-auto leading-relaxed">
                Aún no se han generado los vectores visuales de los productos en la tienda. El personal debe iniciar la indexación desde la sección Archivo.
              </p>
            </div>

            <!-- Caso 2: Se buscaron prendas pero no hubo coincidencias con stock disponible -->
            <div
              *ngIf="indexados() > 0 && resultados().length === 0"
              class="bg-white border border-[#E8E2DA] rounded-2xl p-10 text-center space-y-3"
            >
              <div class="w-14 h-14 rounded-full bg-[#FAF8F5] text-[#9B94A3] flex items-center justify-center mx-auto">
                <span class="material-symbols-outlined text-[30px]">search_off</span>
              </div>
              <h3 class="text-base font-bold text-[#17141A]">No encontramos prendas parecidas con stock</h3>
              <p class="text-xs text-[#5A5561] max-w-md mx-auto leading-relaxed">
                Ninguna prenda con stock disponible alcanzó una coincidencia suficiente con la imagen proporcionada. Podés probar con otra foto, mejor iluminación o un ángulo frontal.
              </p>
            </div>

            <!-- Caso 3: Grilla de Resultados -->
            <div *ngIf="resultados().length > 0" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-bold text-[#17141A]">Prendas similares encontradas</h3>
                  <p class="text-xs text-[#5A5561]">
                    Mostrando {{ resultados().length }} resultados con existencias disponibles, ordenados por similitud visual.
                  </p>
                </div>
                <span class="text-[11px] font-semibold text-[#38133E] bg-[#F5EBF7] px-2.5 py-1 rounded-full border border-[#E8E2DA]">
                  {{ indexados() }} productos comparados
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div
                  *ngFor="let item of resultados()"
                  (click)="onSelectProduct(item.idProducto)"
                  class="bg-white rounded-xl overflow-hidden border border-[#E8E2DA] shadow-xs hover:shadow-md hover:border-[#38133E] transition-all flex flex-col cursor-pointer group"
                >
                  <!-- Imagen y Badge de Similitud -->
                  <div class="aspect-[4/3] w-full bg-[#FAF8F5] overflow-hidden relative">
                    <img
                      [src]="item.imagen_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80'"
                      [alt]="item.nombre"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div class="absolute top-2 left-2">
                      <span class="bg-[#38133E] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px]">auto_awesome</span>
                        <span>{{ formatSimilarity(item.similitud) }}</span>
                      </span>
                    </div>
                    <div class="absolute bottom-2 right-2 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md border border-[#E8E2DA] shadow-xs">
                      <p class="text-xs font-bold text-[#17141A]">{{ formatPrice(item.venta) }}</p>
                    </div>
                  </div>

                  <!-- Datos de la Prenda -->
                  <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-wider text-[#38133E]">
                        {{ item.talla ? 'Talla ' + item.talla : 'Talla única' }} {{ item.color ? '• ' + item.color : '' }}
                      </span>
                      <h4 class="text-xs font-bold text-[#17141A] leading-snug line-clamp-2 mt-0.5">
                        {{ item.nombre }}
                      </h4>
                    </div>

                    <div class="pt-2 border-t border-[#E8E2DA]/60 flex items-center justify-between text-[11px] text-[#5A5561]">
                      <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                        <span>{{ item.stock_total }} en stock</span>
                      </span>
                      <span class="font-bold text-[#38133E] group-hover:underline">Ver detalle</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        <!-- Pie del modal -->
        <div class="p-4 bg-[#FAF8F5] border-t border-[#E8E2DA] flex justify-end shrink-0">
          <button
            type="button"
            (click)="cerrar.emit()"
            class="px-4 py-2 bg-[#38133E] hover:bg-[#260B2B] text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `
})
export class VisualSearchModalComponent implements OnDestroy {
  @Output() cerrar = new EventEmitter<void>();
  @Output() seleccionarProducto = new EventEmitter<number>();

  selectedFile = signal<File | null>(null);
  selectedFileName = signal<string>('');
  selectedFileSize = signal<string>('');
  previewUrl = signal<string | null>(null);

  loading = signal<boolean>(false);
  searched = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  resultados = signal<VisualSearchResultItem[]>([]);
  indexados = signal<number>(0);
  isDragging = signal<boolean>(false);

  private objectUrlToRevoke: string | null = null;

  constructor(private visualSearchService: VisualSearchService) {}

  ngOnDestroy(): void {
    this.cleanupPreviewUrl();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
    input.value = '';
  }

  private processFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('La imagen no es válida o supera 5 MB');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      this.errorMessage.set('La imagen no es válida o supera 5 MB');
      return;
    }

    this.errorMessage.set(null);
    this.selectedFile.set(file);
    this.selectedFileName.set(file.name);
    this.selectedFileSize.set(this.formatBytes(file.size));

    this.cleanupPreviewUrl();
    const url = URL.createObjectURL(file);
    this.objectUrlToRevoke = url;
    this.previewUrl.set(url);

    void this.performSearch(file);
  }

  async performSearch(file: File): Promise<void> {
    this.loading.set(true);
    this.searched.set(false);
    this.errorMessage.set(null);

    try {
      const response = await this.visualSearchService.searchByPhoto(file);
      this.resultados.set(response.resultados || []);
      this.indexados.set(response.indexados ?? 0);
      this.searched.set(true);
    } catch (error: any) {
      console.error('Error en búsqueda visual:', error);
      const detail = error?.error?.detail || error?.message;
      if (typeof detail === 'string' && detail.trim().length > 0) {
        this.errorMessage.set(detail);
      } else {
        this.errorMessage.set('No se pudo procesar la imagen para la búsqueda por foto.');
      }
      this.searched.set(true);
      this.resultados.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  resetSelection(): void {
    this.selectedFile.set(null);
    this.selectedFileName.set('');
    this.selectedFileSize.set('');
    this.cleanupPreviewUrl();
    this.previewUrl.set(null);
    this.resultados.set([]);
    this.indexados.set(0);
    this.searched.set(false);
    this.errorMessage.set(null);
  }

  onSelectProduct(idProducto: number): void {
    this.seleccionarProducto.emit(idProducto);
  }

  formatSimilarity(similitud: number): string {
    const porcentaje = Math.round(similitud * 100);
    return `${porcentaje}% similitud`;
  }

  formatPrice(precio: number): string {
    return `${precio.toLocaleString('es-BO')} Bs`;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private cleanupPreviewUrl(): void {
    if (this.objectUrlToRevoke) {
      URL.revokeObjectURL(this.objectUrlToRevoke);
      this.objectUrlToRevoke = null;
    }
  }
}
