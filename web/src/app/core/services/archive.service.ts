import { Injectable, signal } from '@angular/core';
import { ProductItem } from '../models';
import { NotificationService } from './notification.service';

const INITIAL_ARCHIVE: ProductItem[] = [
  {
    id: 'prd_01',
    sku: 'AETH-CT-001',
    name: 'Kinetic Double-Face Cashmere Overcoat',
    subtitle: 'Unstructured Architectural Outerwear with Floating Lapel',
    collection: 'ESSENTIAL_PERMANENT',
    category: 'OUTERWEAR',
    priceEUR: 2850,
    priceUSD: 3100,
    priceJPY: 460000,
    status: 'AVAILABLE',
    imageUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=800&auto=format&fit=crop&q=80'
    ],
    materials: [
      { name: 'Grade-A Mongolian Cashmere', percentage: 85, origin: 'Alashan Plateau, Inner Mongolia', certifications: ['Sustainable Fibre Alliance', 'OEKO-TEX Standard 100'] },
      { name: 'Mulberry Raw Silk Weft', percentage: 15, origin: 'Kyoto Prefecture, Japan', certifications: ['GOTS Certified Silk'] }
    ],
    sizes: { 'XS': 6, 'S': 14, 'M': 18, 'L': 12, 'XL': 4 },
    colorway: 'Obsidian Sand / Mineral Charcoal',
    colorHex: '#2C2A26',
    seasonYear: 'Permanent Core 2026',
    designerNotes: 'Milled in Biella, Italy using water-powered looms. Features concealed magnetic storm closures and laser-beveled interior horn buttons.'
  },
  {
    id: 'prd_02',
    sku: 'AETH-BL-004',
    name: 'Sculptural Wool-Silk Crepe Blazer',
    subtitle: 'Zero-Seam Raglan Shoulder with Internal Canvas Structure',
    collection: 'ARCHIVE_AW25',
    category: 'TAILORING',
    priceEUR: 1950,
    priceUSD: 2150,
    priceJPY: 315000,
    status: 'AVAILABLE',
    imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80'
    ],
    materials: [
      { name: 'Super 160s Virgin Merino Wool', percentage: 70, origin: 'Tasmania / Biella Processing' },
      { name: 'Habotai Silk Lining', percentage: 30, origin: 'Como, Italy' }
    ],
    sizes: { 'XS': 8, 'S': 20, 'M': 22, 'L': 15, 'XL': 7 },
    colorway: 'Bone Ivory / Warm Calcite',
    colorHex: '#F2E1C0',
    seasonYear: 'Autumn/Winter 2025-26',
    designerNotes: 'Structured chest piece sculpted over 72 hours of steam shaping. Unisex silhouette calibrated for fluid drape.'
  },
  {
    id: 'prd_03',
    sku: 'AETH-KN-012',
    name: 'Seamless 3D-Knit Merino Mockneck',
    subtitle: 'Whole-Garment Zero-Waste Gauge 18 Architecture',
    collection: 'ESSENTIAL_PERMANENT',
    category: 'KNITWEAR',
    priceEUR: 780,
    priceUSD: 850,
    priceJPY: 125000,
    status: 'AVAILABLE',
    imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [],
    materials: [
      { name: 'Extra-Fine Merino Worsted (15.5 Micron)', percentage: 100, origin: 'New Zealand / Zegna Baruffa' }
    ],
    sizes: { 'XS': 12, 'S': 28, 'M': 35, 'L': 24, 'XL': 11 },
    colorway: 'Deep Umber / Raw Earth',
    colorHex: '#39270F',
    seasonYear: 'Permanent Core 2026',
    designerNotes: 'Knit continuously in Shima Seiki WHOLEGARMENT machines in Wakayama, eliminating all seams for frictionless skin contact.'
  },
  {
    id: 'prd_04',
    sku: 'AETH-TR-008',
    name: 'Pleated Flannel Wide-Leg Trouser',
    subtitle: 'Extended Waistband with Internal Japanese Grosgrain Adjusters',
    collection: 'ARCHIVE_AW25',
    category: 'TROUSERS',
    priceEUR: 920,
    priceUSD: 1000,
    priceJPY: 148000,
    status: 'AVAILABLE',
    imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [],
    materials: [
      { name: 'Milled Wool Flannel 340gsm', percentage: 95, origin: 'Yorkshire, United Kingdom' },
      { name: 'Elastane Memory Filament', percentage: 5, origin: 'Brescia, Italy' }
    ],
    sizes: { 'XS': 5, 'S': 16, 'M': 20, 'L': 14, 'XL': 5 },
    colorway: 'Smoked Basalt',
    colorHex: '#4A463F',
    seasonYear: 'Autumn/Winter 2025-26',
    designerNotes: 'Hand-pressed deep inverted front pleats creating architectural volume in motion.'
  },
  {
    id: 'prd_05',
    sku: 'AETH-PK-002',
    name: 'Modular Storm Tech-Silk Shell',
    subtitle: '3-Layer Hydrophobic Silk-Nylon Hybrid Membrane',
    collection: 'ATELIER_SS26',
    category: 'OUTERWEAR',
    priceEUR: 2400,
    priceUSD: 2600,
    priceJPY: 388000,
    status: 'VAULT_ONLY',
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [],
    materials: [
      { name: 'Technical Silk Ripstop', percentage: 65, origin: 'Fukui, Japan' },
      { name: 'Bio-Based Recycled Polyamide', percentage: 35, origin: 'Lenzing, Austria' }
    ],
    sizes: { 'XS': 2, 'S': 5, 'M': 7, 'L': 4, 'XL': 1 },
    colorway: 'Desert Calcite / Kinetic Amber',
    colorHex: '#8C7355',
    seasonYear: 'Spring/Summer Atelier 2026',
    designerNotes: 'Ultralight 110gsm technical garment with welded ultrasonic seams and titanium bungee cinch hardware.'
  },
  {
    id: 'prd_06',
    sku: 'AETH-FT-001',
    name: 'Anatomical Calfskin Loafer',
    subtitle: 'Blake-Rapid Stitch with Recycled Crepe Outsole Inlay',
    collection: 'ESSENTIAL_PERMANENT',
    category: 'FOOTWEAR',
    priceEUR: 1250,
    priceUSD: 1380,
    priceJPY: 202000,
    status: 'AVAILABLE',
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
    secondaryImages: [],
    materials: [
      { name: 'Full-Grain Box Calf Leather', percentage: 100, origin: 'Tanneries Haas, Alsace France' }
    ],
    sizes: { '39': 4, '40': 8, '41': 14, '42': 16, '43': 12, '44': 6 },
    colorway: 'Pitch Black Monolith',
    colorHex: '#171612',
    seasonYear: 'Permanent Core 2026',
    designerNotes: 'Hand-burnished vegetable tanned leather with memory-foam footbed shaped according to biomechanical balance.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ArchiveService {
  private productsSignal = signal<ProductItem[]>(INITIAL_ARCHIVE);
  public products = this.productsSignal.asReadonly();

  constructor(private notificationService: NotificationService) {}

  getProductById(id: string): ProductItem | undefined {
    return this.productsSignal().find(p => p.id === id);
  }

  addProduct(newProduct: Omit<ProductItem, 'id'>) {
    const id = 'prd_' + Date.now().toString(36);
    const product: ProductItem = { ...newProduct, id };
    this.productsSignal.update(list => [product, ...list]);
    this.notificationService.success('Archive Updated', `Garment "${product.name}" added to AETHER core catalog.`);
    return product;
  }

  updateProduct(id: string, updates: Partial<ProductItem>) {
    this.productsSignal.update(list =>
      list.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
    this.notificationService.info('Garment Updated', `Specifications updated for SKU: ${updates.sku || id}`);
  }

  deleteProduct(id: string) {
    const item = this.getProductById(id);
    this.productsSignal.update(list => list.filter(p => p.id !== id));
    this.notificationService.warning('Archive Removed', `Garment ${item?.name || id} archived and removed from active roster.`);
  }
}
