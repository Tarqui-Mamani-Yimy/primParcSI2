import assert from 'node:assert/strict';
import { PromotionsService } from './promotions.service';
import type { ProductOut, Promocion } from '../models';

/**
 * Deterministic tests for PromotionsService.quoteOffline (B1 / S4 / S9).
 * Can be run via: npx tsx src/app/core/services/promotions.service.spec.ts
 */
function runTests(): void {
  const service = new PromotionsService(null as any);

  const product1: ProductOut = {
    idProducto: 1,
    idColeccion: 1,
    idProveedor: 1,
    proveedor_nombre: 'Proveedor 1',
    coleccion_nombre: 'Coleccion 1',
    nombre: 'Polera Clásica',
    descripcion: null,
    tipo: 'Polera',
    talla: 'M',
    color: 'Blanco',
    costo: 5,
    venta: 10,
    imagen_url: null,
    imagenes_secundarias: [],
  };

  const product2: ProductOut = {
    idProducto: 2,
    idColeccion: 1,
    idProveedor: 1,
    proveedor_nombre: 'Proveedor 1',
    coleccion_nombre: 'Coleccion 1',
    nombre: 'Pantalón Jean',
    descripcion: null,
    tipo: 'Pantalón',
    talla: '32',
    color: 'Azul',
    costo: 30,
    venta: 100,
    imagen_url: null,
    imagenes_secundarias: [],
  };

  const getProduct = (id: number) => {
    if (id === 1) return product1;
    if (id === 2) return product2;
    return undefined;
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Caso de verificación B1 (precio 10.00, 3x2, cantidad 7)
  // Servidor da 50.05 con precio unitario 7.15 (ROUND_UP a centavos)
  // ─────────────────────────────────────────────────────────────
  {
    const promo3x2: Promocion = {
      idPromocion: 1,
      idEmpresa: 1,
      nombre: 'Lleva 3 Paga 2',
      tipo: 'nxm',
      valor: null,
      n: 3,
      m: 2,
      alcance: 'todos',
      alcance_ref: null,
      fecha_inicio: '2020-01-01T00:00:00Z',
      fecha_fin: '2030-01-01T00:00:00Z',
      activa: true,
      productos: null,
    };
    service.activePromotions.set([promo3x2]);

    const res = service.quoteOffline([{ idProducto: 1, cantidad: 7 }], getProduct);
    const lineas = res.lineas!;
    assert.equal(res.subtotal, 70.00, 'Subtotal debe ser 70.00');
    assert.equal(res.total, 50.05, 'Total debe ser 50.05 exactamente igual que pricing.py');
    assert.equal(res.descuento_promociones, 19.95, 'Descuento total debe ser 19.95');
    assert.equal(lineas[0].precio_unitario, 7.15, 'Precio unitario redondeado hacia arriba debe ser 7.15');
    assert.equal(lineas[0].descuento_promocion, 19.95, 'Descuento de línea debe ser 19.95');
    assert.equal(
      Number((lineas[0].precio_unitario * 7).toFixed(2)),
      res.total,
      'Invariante Venta.total == precio_unitario * cantidad debe cumplirse',
    );
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Promoción por porcentaje con alcance específico por productos[]
  // ─────────────────────────────────────────────────────────────
  {
    const promoPorcentaje: Promocion = {
      idPromocion: 2,
      idEmpresa: 1,
      nombre: '20% OFF en Jeans',
      tipo: 'porcentaje',
      valor: 20,
      n: null,
      m: null,
      alcance: 'producto',
      alcance_ref: '2',
      fecha_inicio: '2020-01-01T00:00:00Z',
      fecha_fin: '2030-01-01T00:00:00Z',
      activa: true,
      productos: [2], // Solo aplica a producto 2
    };
    service.activePromotions.set([promoPorcentaje]);

    const res = service.quoteOffline(
      [
        { idProducto: 1, cantidad: 2 }, // 2 * 10 = 20 (sin promo)
        { idProducto: 2, cantidad: 3 }, // 3 * 100 = 300 - 20% (60) = 240
      ],
      getProduct,
    );

    const lineas = res.lineas!;
    assert.equal(res.subtotal, 320.00);
    assert.equal(res.descuento_promociones, 60.00);
    assert.equal(res.total, 260.00);
    assert.equal(lineas[0].precio_unitario, 10.00);
    assert.equal(lineas[1].precio_unitario, 80.00);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Desempate de promociones idénticas (menor idPromocion gana)
  // ─────────────────────────────────────────────────────────────
  {
    const promoA: Promocion = {
      idPromocion: 10,
      idEmpresa: 1,
      nombre: 'Promo A 10%',
      tipo: 'porcentaje',
      valor: 10,
      n: null,
      m: null,
      alcance: 'todos',
      alcance_ref: null,
      fecha_inicio: '2020-01-01T00:00:00Z',
      fecha_fin: '2030-01-01T00:00:00Z',
      activa: true,
      productos: null,
    };
    const promoB: Promocion = {
      idPromocion: 5,
      idEmpresa: 1,
      nombre: 'Promo B 10%',
      tipo: 'porcentaje',
      valor: 10,
      n: null,
      m: null,
      alcance: 'todos',
      alcance_ref: null,
      fecha_inicio: '2020-01-01T00:00:00Z',
      fecha_fin: '2030-01-01T00:00:00Z',
      activa: true,
      productos: null,
    };
    service.activePromotions.set([promoA, promoB]);

    const res = service.quoteOffline([{ idProducto: 1, cantidad: 1 }], getProduct);
    const lineas = res.lineas!;
    assert.equal(lineas[0].idPromocion, 5, 'Debe ganar la de menor idPromocion (5 frente a 10)');
  }

  console.log('✓ Todos los tests deterministas de PromotionsService pasaron exitosamente.');
}

runTests();
