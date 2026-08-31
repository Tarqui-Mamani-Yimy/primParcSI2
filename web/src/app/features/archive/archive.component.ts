import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArchiveService } from '../../core/services/archive.service';
import { ProductItem } from '../../core/models';

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      <!-- Top Title & Action Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-gray-200">
        <div>
          <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Curated Garment Architecture
          </span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
            AETHER Archive & Essential Catalog
          </h1>
          <p class="text-xs text-gray-500 mt-1">
            Official register of permanent essential wear, certified yarn specifications, and seasonal releases.
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            (click)="openCreateModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide uppercase transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            <span>Curate New Garment</span>
          </button>
        </div>
      </div>

      <!-- Filters & Category Navigation Bar -->
      <div class="flex flex-wrap items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        
        <!-- Collection Filter Tabs -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            (click)="selectedCollection.set('ALL')"
            [class.bg-indigo-600]="selectedCollection() === 'ALL'"
            [class.text-white]="selectedCollection() === 'ALL'"
            [class.text-gray-600]="selectedCollection() !== 'ALL'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            All Collections
          </button>
          <button
            (click)="selectedCollection.set('ESSENTIAL_PERMANENT')"
            [class.bg-indigo-600]="selectedCollection() === 'ESSENTIAL_PERMANENT'"
            [class.text-white]="selectedCollection() === 'ESSENTIAL_PERMANENT'"
            [class.text-gray-600]="selectedCollection() !== 'ESSENTIAL_PERMANENT'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Essential Permanent
          </button>
          <button
            (click)="selectedCollection.set('ARCHIVE_AW25')"
            [class.bg-indigo-600]="selectedCollection() === 'ARCHIVE_AW25'"
            [class.text-white]="selectedCollection() === 'ARCHIVE_AW25'"
            [class.text-gray-600]="selectedCollection() !== 'ARCHIVE_AW25'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Archive AW25
          </button>
          <button
            (click)="selectedCollection.set('ATELIER_SS26')"
            [class.bg-indigo-600]="selectedCollection() === 'ATELIER_SS26'"
            [class.text-white]="selectedCollection() === 'ATELIER_SS26'"
            [class.text-gray-600]="selectedCollection() !== 'ATELIER_SS26'"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            SS26 Atelier
          </button>
        </div>

        <!-- Search Bar -->
        <div class="relative min-w-[240px]">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">
            search
          </span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search SKU, fabric, title..."
            class="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <!-- Garment Gallery Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          *ngFor="let item of filteredProducts()"
          class="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-sm hover:border-gray-300 transition-all flex flex-col group"
        >
          <!-- Garment Image Stage -->
          <div class="aspect-[4/3] w-full bg-gray-100 overflow-hidden relative">
            <img
              [src]="item.imageUrl"
              [alt]="item.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <!-- Badges -->
            <div class="absolute top-3 left-3 flex flex-col gap-1.5">
              <span class="px-2.5 py-1 bg-gray-900/90 backdrop-blur-xs text-white rounded-md text-[10px] font-bold tracking-wider uppercase shadow-xs">
                {{ item.sku }}
              </span>
              <span
                *ngIf="item.status === 'VAULT_ONLY'"
                class="px-2 py-0.5 bg-amber-500 text-white rounded text-[9px] font-bold uppercase shadow-xs"
              >
                Vault Reserved
              </span>
            </div>

            <!-- Price in EUR & JPY -->
            <div class="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-gray-200/80 shadow-xs text-right">
              <p class="text-xs font-bold text-gray-900">
                €{{ item.priceEUR.toLocaleString() }}
              </p>
              <p class="text-[10px] text-gray-500">
                ¥{{ item.priceJPY.toLocaleString() }} / USD {{ item.priceUSD.toLocaleString() }}
              </p>
            </div>
          </div>

          <!-- Garment Content -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {{ item.category }} • {{ item.seasonYear }}
                </span>
                <div class="flex items-center space-x-1.5">
                  <span class="w-2.5 h-2.5 rounded-full border border-gray-300" [style.backgroundColor]="item.colorHex"></span>
                  <span class="text-xs text-gray-500">{{ item.colorway.split('/')[0] }}</span>
                </div>
              </div>

              <h3 class="text-base font-bold text-gray-900 leading-snug">
                {{ item.name }}
              </h3>
              <p class="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">
                {{ item.subtitle }}
              </p>
            </div>

            <!-- Materials & Provenance Pill -->
            <div class="p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs space-y-1">
              <div *ngFor="let mat of item.materials" class="flex justify-between items-center text-gray-800">
                <span class="font-medium">{{ mat.percentage }}% {{ mat.name }}</span>
                <span class="text-[11px] text-gray-500 truncate max-w-[140px]">{{ mat.origin.split(',')[0] }}</span>
              </div>
            </div>

            <!-- Card Footer: Inspect Button & Size Count -->
            <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div class="flex gap-1 text-xs">
                <span *ngFor="let s of getAvailableSizes(item)" class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[11px]">
                  {{ s }}
                </span>
              </div>
              <button
                (click)="inspectProduct(item)"
                class="px-3 py-1.5 bg-gray-900 text-white hover:bg-indigo-600 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
              >
                Inspect Specs
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Garment Detailed Inspection Modal -->
    <div *ngIf="inspectingItem()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-3xl w-full rounded-2xl border border-gray-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col relative">
        
        <!-- Close Button -->
        <button
          (click)="inspectingItem.set(null)"
          class="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 shadow-sm text-gray-700 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div class="overflow-y-auto p-6 md:p-8 space-y-6">
          <div *ngIf="inspectingItem() as p">
            
            <!-- Top Header -->
            <div class="flex flex-col md:flex-row gap-6">
              <div class="w-full md:w-1/2 aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img [src]="p.imageUrl" [alt]="p.name" class="w-full h-full object-cover" />
              </div>
              <div class="w-full md:w-1/2 flex flex-col justify-between">
                <div>
                  <span class="text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
                    {{ p.sku }} • {{ p.collection.replace('_', ' ') }}
                  </span>
                  <h2 class="text-xl font-bold text-gray-900 mt-1 leading-snug">
                    {{ p.name }}
                  </h2>
                  <p class="text-xs text-gray-600 mt-1">
                    {{ p.subtitle }}
                  </p>
                </div>

                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 my-3">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Global Retail Valuation</p>
                  <p class="text-xl font-bold text-gray-900 mt-0.5">
                    €{{ p.priceEUR.toLocaleString() }} <span class="text-xs font-normal text-gray-500">(EUR)</span>
                  </p>
                  <p class="text-xs text-gray-600 mt-1">
                    USD: {{ p.priceUSD.toLocaleString() }} | JPY: ¥{{ p.priceJPY.toLocaleString() }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Material Provenance & Certifications -->
            <div class="mt-6 pt-6 border-t border-gray-100 space-y-3">
              <h3 class="text-sm font-bold text-gray-900">
                Material Composition & Origin Provenance
              </h3>
              <div class="space-y-2.5">
                <div *ngFor="let m of p.materials" class="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-900 text-xs">{{ m.percentage }}% {{ m.name }}</span>
                    <span class="text-xs text-indigo-600 font-semibold">Origin: {{ m.origin }}</span>
                  </div>
                  <div *ngIf="m.certifications && m.certifications.length > 0" class="flex gap-1.5 mt-2">
                    <span *ngFor="let c of m.certifications" class="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600">
                      {{ c }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Designer Architectural Notes -->
            <div class="mt-6 pt-6 border-t border-gray-100">
              <h3 class="text-sm font-bold text-gray-900 mb-2">
                Atelier Notes & Construction Architecture
              </h3>
              <p class="text-xs text-gray-600 leading-relaxed p-4 rounded-xl bg-gray-50 border border-gray-200 italic">
                "{{ p.designerNotes }}"
              </p>
            </div>

            <!-- Size Network Matrix -->
            <div class="mt-6 pt-6 border-t border-gray-100">
              <h3 class="text-sm font-bold text-gray-900 mb-3">
                Global Stock Across Sizes
              </h3>
              <div class="grid grid-cols-5 gap-2 text-center">
                <div *ngFor="let key of getKeys(p.sizes)" class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p class="text-xs font-bold text-gray-500">Size {{ key }}</p>
                  <p class="text-base font-bold text-gray-900 mt-0.5">{{ p.sizes[key] }} pcs</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button (click)="inspectingItem.set(null)" class="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors">
            Close Dossier
          </button>
        </div>
      </div>
    </div>

    <!-- Curate New Garment Modal -->
    <div *ngIf="showCreateModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div class="bg-white max-w-xl w-full rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
        <button (click)="showCreateModal.set(false)" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="mb-5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Atelier Curation</span>
          <h2 class="text-lg font-bold text-gray-900 mt-0.5">Register Archive Garment</h2>
          <p class="text-xs text-gray-500">Add a new essential piece to the master catalog and allocate network SKUs.</p>
        </div>

        <form (ngSubmit)="saveNewGarment()" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Garment Name</label>
              <input type="text" [(ngModel)]="newGarment.name" name="name" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Kinetic Alpaca Poncho" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">SKU Code</label>
              <input type="text" [(ngModel)]="newGarment.sku" name="sku" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="AETH-PC-009" />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Architectural Subtitle</label>
            <input type="text" [(ngModel)]="newGarment.subtitle" name="subtitle" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Seamless Zero-Draft Cut with Peruvian Suri Fleece" />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Category</label>
              <select [(ngModel)]="newGarment.category" name="category" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="OUTERWEAR">Outerwear</option>
                <option value="TAILORING">Tailoring</option>
                <option value="KNITWEAR">Knitwear</option>
                <option value="TROUSERS">Trousers</option>
                <option value="FOOTWEAR">Footwear</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Collection</label>
              <select [(ngModel)]="newGarment.collection" name="collection" class="w-full mt-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="ESSENTIAL_PERMANENT">Essential Permanent</option>
                <option value="ARCHIVE_AW25">Archive AW25</option>
                <option value="ATELIER_SS26">Atelier SS26</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Price EUR (€)</label>
              <input type="number" [(ngModel)]="newGarment.priceEUR" name="price" required class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="1850" />
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Primary Fabric Material & Origin</label>
            <input type="text" [(ngModel)]="newFabric" name="fabric" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="100% Baby Alpaca (Arequipa, Peru)" />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Atelier Notes</label>
            <textarea [(ngModel)]="newGarment.designerNotes" name="notes" rows="2" class="w-full mt-1 px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="Hand-finished fringed borders with biological water-repellent wax treatment."></textarea>
          </div>

          <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors shadow-xs mt-4">
            Curate & Commit to Archive
          </button>
        </form>
      </div>
    </div>
  `
})
export class ArchiveComponent {
  selectedCollection = signal<string>('ALL');
  searchQuery = '';
  inspectingItem = signal<ProductItem | null>(null);
  showCreateModal = signal<boolean>(false);

  newFabric = '100% Baby Alpaca (Arequipa, Peru)';
  newGarment: Partial<ProductItem> = {
    name: '',
    sku: 'AETH-AL-007',
    subtitle: '',
    category: 'OUTERWEAR',
    collection: 'ESSENTIAL_PERMANENT',
    priceEUR: 1650,
    priceUSD: 1800,
    priceJPY: 260000,
    status: 'AVAILABLE',
    imageUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [],
    sizes: { 'S': 8, 'M': 12, 'L': 6 },
    colorway: 'Natural Vicuña / Warm Calcite',
    colorHex: '#8C7355',
    seasonYear: 'Core 2026',
    designerNotes: ''
  };

  constructor(public archiveService: ArchiveService) {}

  filteredProducts = computed(() => {
    let list = this.archiveService.products();
    if (this.selectedCollection() !== 'ALL') {
      list = list.filter(p => p.collection === this.selectedCollection());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.subtitle.toLowerCase().includes(q) ||
          p.materials.some(m => m.name.toLowerCase().includes(q))
      );
    }
    return list;
  });

  inspectProduct(item: ProductItem) {
    this.inspectingItem.set(item);
  }

  getAvailableSizes(item: ProductItem): string[] {
    return Object.keys(item.sizes);
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  openCreateModal() {
    this.showCreateModal.set(true);
  }

  saveNewGarment() {
    if (!this.newGarment.name) return;

    this.archiveService.addProduct({
      sku: this.newGarment.sku || 'AETH-000',
      name: this.newGarment.name,
      subtitle: this.newGarment.subtitle || 'Essential Architectural Garment',
      category: this.newGarment.category || 'OUTERWEAR',
      collection: this.newGarment.collection || 'ESSENTIAL_PERMANENT',
      priceEUR: Number(this.newGarment.priceEUR) || 1200,
      priceUSD: (Number(this.newGarment.priceEUR) || 1200) * 1.1,
      priceJPY: (Number(this.newGarment.priceEUR) || 1200) * 160,
      status: 'AVAILABLE',
      imageUrl: this.newGarment.imageUrl || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      secondaryImages: [],
      materials: [
        { name: this.newFabric, percentage: 100, origin: 'Certified Sustainable Mill' }
      ],
      sizes: { 'S': 6, 'M': 10, 'L': 6 },
      colorway: 'Obsidian Sand',
      colorHex: '#2C2A26',
      seasonYear: 'Core 2026',
      designerNotes: this.newGarment.designerNotes || 'Precision crafted with reinforced stitch lines.'
    });

    this.showCreateModal.set(false);
  }
}
