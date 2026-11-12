import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/aether_theme.dart';
import '../providers/app_state.dart';
import '../data/offline_database.dart';
import '../models/sales_quote.dart';
import '../models/sucursal_model.dart';
import '../services/api_client.dart';
import '../services/locations_service.dart';
import '../services/offline_purchases_service.dart';
import '../services/payments_service.dart';
import '../services/sales_service.dart';
import '../services/sales_quote_service.dart';
import '../services/offline_promotion_calculator.dart';

/// Mobile Fase 2: checkout real. Misma maquina de estados que
/// `web/src/app/features/customer/checkout/purchase-modal.component.ts`
/// (ya probada esta sesion) — el pago SIEMPRE se obtiene antes de crear la
/// Venta, y si la Venta falla DESPUES de un cobro ya verificado, el
/// `idMetPago` se retiene para reintentar sin volver a cobrar.
enum _CheckoutStatus { idle, cobrando, cobradoSinVenta, error }

class CartModal extends StatefulWidget {
  const CartModal({super.key});

  @override
  State<CartModal> createState() => _CartModalState();
}

class _CartModalState extends State<CartModal> {
  final ApiClient _api = ApiClient();
  late final PaymentsService _paymentsService = PaymentsService(_api);
  late final SalesService _salesService = SalesService(_api);
  late final SalesQuoteService _quoteService = SalesQuoteService(_api);
  late final LocationsService _locationsService = LocationsService(_api);
  final _couponController = TextEditingController();
  final _pointsController = TextEditingController();
  final _offlineCalculator = OfflinePromotionCalculator();
  List<OfflinePromotion> _cachedPromotions = const [];
  Map<int, int> _collectionSeasons = const {};
  SalesQuote? _quote;
  bool _quoteLoading = false;

  _CheckoutStatus _status = _CheckoutStatus.idle;
  String? _errorMessage;
  int? _idMetPagoRetenido;
  List<Map<String, dynamic>>? _itemsRetenidos;
  String? _codigoCuponRetenido;
  int? _puntosRetenidos;

  List<Sucursal> _sucursales = const [];
  int? _codigoSucursalOffline;
  bool _guardandoOffline = false;

  @override
  void initState() {
    super.initState();
    _cargarPromocionesOffline();
    _cargarSucursales();
  }

  /// Branches for an offline purchase (read from the SQLite cache when there
  /// is no connection). Defaults to the first branch with stock for the cart.
  Future<void> _cargarSucursales() async {
    final items = _itemsDesdeCarrito(context.read<AppState>());
    try {
      final sucursales = await _locationsService.getSucursales();
      int? sugerida;
      final database = OfflineDatabaseRegistry.activeDatabase;
      if (database != null) {
        final inventario = await database.readRows('inventario');
        for (final sucursal in sucursales) {
          final tieneTodo = items.every((item) => inventario.any((inv) =>
              inv['codigoSucursal'] == sucursal.codigoSucursal &&
              inv['idProducto'] == item['idProducto'] &&
              ((inv['cantidad_actual'] as num? ?? 0) -
                      (inv['cantidad_reservada'] as num? ?? 0)) >=
                  (item['cantidad'] as int)));
          if (tieneTodo) {
            sugerida = sucursal.codigoSucursal;
            break;
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _sucursales = sucursales;
        _codigoSucursalOffline = sugerida ??
            (sucursales.isNotEmpty ? sucursales.first.codigoSucursal : null);
      });
    } catch (_) {
      // Without cached branches the offline purchase stays unavailable.
    }
  }

  Future<void> _comprarOffline(AppState appState) async {
    final database = OfflineDatabaseRegistry.activeDatabase;
    final codigoSucursal = _codigoSucursalOffline;
    if (database == null || codigoSucursal == null) return;
    setState(() {
      _guardandoOffline = true;
      _errorMessage = null;
    });
    try {
      final total = _quoteOffline(appState).total;
      final compra = await OfflinePurchasesService.create(
        database: database,
        codigoSucursal: codigoSucursal,
        items: _itemsDesdeCarrito(appState),
        totalEstimado: total,
      );
      appState.clearCart();
      if (!mounted) return;
      final sucursal = _sucursales
          .where((s) => s.codigoSucursal == codigoSucursal)
          .map((s) => s.nombre)
          .firstOrNull;
      Navigator.of(context).pop();
      _mostrarConfirmacionOffline(compra, sucursal);
    } on StateError catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } catch (_) {
      if (mounted) {
        setState(
            () => _errorMessage = 'No se pudo guardar la compra sin conexión.');
      }
    } finally {
      if (mounted) setState(() => _guardandoOffline = false);
    }
  }

  void _mostrarConfirmacionOffline(
      Map<String, dynamic> compra, String? sucursal) {
    final navigator = Navigator.of(context, rootNavigator: true);
    showDialog(
      context: navigator.context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AetherTheme.sandLight,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        title: Text('Compra guardada sin conexión',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Comprobante ${compra['comprobanteLocal']}',
                style: GoogleFonts.sourceSerif4(fontSize: 14)),
            const SizedBox(height: 8),
            Text(
              'Total estimado: \$${(compra['totalEstimado'] as num).toStringAsFixed(2)}',
              style: GoogleFonts.sourceSerif4(
                  fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Se registrará automáticamente cuando vuelvas a tener conexión. '
              'Pagás en efectivo al retirar${sucursal == null ? '' : ' en $sucursal'}.',
              style: GoogleFonts.outfit(fontSize: 12, color: AetherTheme.muted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _couponController.dispose();
    _pointsController.dispose();
    super.dispose();
  }

  Future<void> _cargarPromocionesOffline() async {
    if (context.read<AppState>().currentUser?.hasFeature('promociones') !=
        true) {
      return;
    }
    final database = OfflineDatabaseRegistry.activeDatabase;
    if (database == null) return;
    try {
      final promotionsJson = await database.readMetadata('active_promotions');
      final seasonsJson = await database.readMetadata('collection_seasons');
      final promotions = promotionsJson == null
          ? <OfflinePromotion>[]
          : (jsonDecode(promotionsJson) as List)
              .map((row) => OfflinePromotion.fromJson(
                  Map<String, dynamic>.from(row as Map)))
              .toList();
      final seasons = seasonsJson == null
          ? <int, int>{}
          : (jsonDecode(seasonsJson) as Map).map((key, value) =>
              MapEntry(int.parse(key.toString()), (value as num).toInt()));
      if (!mounted) return;
      setState(() {
        _cachedPromotions = promotions;
        _collectionSeasons = seasons;
      });
    } catch (_) {
      // An absent/corrupt optional promotion snapshot leaves list prices intact.
    }
  }

  OfflinePromotionQuote _quoteOffline(AppState appState) =>
      _offlineCalculator.quote(
        appState.cart
            .map((item) => OfflineCartLine(
                  idProducto: int.tryParse(item.product.id) ?? 0,
                  cantidad: item.quantity,
                  precio: item.product.price,
                  idColeccion: item.product.idColeccion,
                  idTemporada: item.product.idTemporada ??
                      _collectionSeasons[item.product.idColeccion],
                  tipo: item.product.category,
                ))
            .toList(),
        appState.currentUser?.hasFeature('promociones') == true
            ? _cachedPromotions
            : const <OfflinePromotion>[],
        now: DateTime.now(),
      );

  List<Map<String, dynamic>> _itemsDesdeCarrito(AppState appState) {
    return appState.cart
        .map((item) => {
              'idProducto': int.parse(item.product.id),
              'cantidad': item.quantity,
            })
        .toList();
  }

  Future<SalesQuote> _cotizar(AppState appState) async {
    final quote = await _quoteService.quote(
      _itemsDesdeCarrito(appState),
      codigoCupon: _couponController.text.trim().isEmpty
          ? null
          : _couponController.text.trim(),
      puntos: int.tryParse(_pointsController.text.trim()),
    );
    if (mounted) setState(() => _quote = quote);
    return quote;
  }

  Future<void> _actualizarCotizacion(AppState appState) async {
    setState(() {
      _quoteLoading = true;
      _errorMessage = null;
    });
    try {
      await _cotizar(appState);
    } on ApiException catch (error) {
      if (mounted) setState(() => _errorMessage = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _errorMessage = 'No se pudo calcular el total.');
      }
    } finally {
      if (mounted) setState(() => _quoteLoading = false);
    }
  }

  Future<void> _iniciarCheckout(AppState appState) async {
    if (!appState.isOnline) return;
    final items = _itemsDesdeCarrito(appState);
    setState(() {
      _status = _CheckoutStatus.cobrando;
      _errorMessage = null;
    });

    try {
      final quote = await _cotizar(appState);
      final codigoCupon =
          quote.idCupon == null ? null : _couponController.text.trim();
      final puntos = quote.puntosCanjeados;
      final intent = await _paymentsService.crearIntent(
        items,
        concepto: 'Compra Voguely',
        codigoCupon: codigoCupon,
        puntos: puntos,
      );
      final clientSecret = intent['clientSecret'] as String;

      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Voguely',
        ),
      );
      // Si el usuario cancela o la tarjeta es rechazada, esto lanza
      // StripeException y no se llega a cobrar nada — el carrito queda
      // intacto y se puede reintentar desde cero (nuevo intent).
      await Stripe.instance.presentPaymentSheet();

      final paymentIntentId = intent['paymentIntentId'] as String;
      final verificado =
          await _paymentsService.verificarIntent(paymentIntentId);

      final pagado = verificado['pagado'] == true;
      final idMetPago = verificado['idMetPago'] as int?;
      if (!pagado || idMetPago == null) {
        // El widget reporto exito del lado del cliente, pero el servidor
        // aun no confirma el cobro: NUNCA se crea la Venta en este caso
        // (mismo criterio que la web).
        setState(() {
          _status = _CheckoutStatus.error;
          _errorMessage =
              'No se pudo confirmar el cobro con el servidor. Si tu tarjeta fue debitada, contacta a soporte antes de reintentar.';
        });
        return;
      }

      await _crearVenta(appState, idMetPago, items,
          codigoCupon: codigoCupon, puntos: puntos);
    } on StripeException catch (e) {
      // API de flutter_stripe no verificada contra pub.dev en esta sesion
      // (sin toolchain) — `e.error.localizedMessage` es el campo esperado
      // en versiones recientes del paquete; se cae a `.code` si viniera
      // null, para nunca mostrar un mensaje vacio.
      setState(() {
        _status = _CheckoutStatus.error;
        _errorMessage = e.error.localizedMessage ??
            'El pago fue cancelado o rechazado (${e.error.code}).';
      });
    } on ApiException catch (e) {
      setState(() {
        _status = _CheckoutStatus.error;
        _errorMessage = e.message;
      });
    } catch (_) {
      setState(() {
        _status = _CheckoutStatus.error;
        _errorMessage = 'No se pudo completar la compra. Intenta de nuevo.';
      });
    }
  }

  Future<void> _crearVenta(
      AppState appState, int idMetPago, List<Map<String, dynamic>> items,
      {String? codigoCupon, int? puntos}) async {
    try {
      final venta = await _salesService.crearVenta(idMetPago, items,
          codigoCupon: codigoCupon, puntos: puntos);
      appState.clearCart();
      setState(() {
        _status = _CheckoutStatus.idle;
        _idMetPagoRetenido = null;
        _itemsRetenidos = null;
        _codigoCuponRetenido = null;
        _puntosRetenidos = null;
        _quote = null;
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      _mostrarConfirmacion(venta);
    } on ApiException catch (e) {
      // El idMetPago YA fue cobrado (verificado): se retiene para
      // reintentar, NUNCA se vuelve a cobrar.
      setState(() {
        _status = _CheckoutStatus.cobradoSinVenta;
        _errorMessage = e.message;
        _idMetPagoRetenido = idMetPago;
        _itemsRetenidos = items;
        _codigoCuponRetenido = codigoCupon;
        _puntosRetenidos = puntos;
      });
    } catch (_) {
      setState(() {
        _status = _CheckoutStatus.cobradoSinVenta;
        _errorMessage = 'Cobro confirmado, pero no pudimos registrar la venta.';
        _idMetPagoRetenido = idMetPago;
        _itemsRetenidos = items;
        _codigoCuponRetenido = codigoCupon;
        _puntosRetenidos = puntos;
      });
    }
  }

  Future<void> _reintentarVenta(AppState appState) async {
    final idMetPago = _idMetPagoRetenido;
    final items = _itemsRetenidos;
    if (idMetPago == null || items == null) return;
    setState(() => _status = _CheckoutStatus.cobrando);
    await _crearVenta(appState, idMetPago, items,
        codigoCupon: _codigoCuponRetenido, puntos: _puntosRetenidos);
  }

  void _mostrarConfirmacion(Map<String, dynamic> venta) {
    final fecha = DateTime.tryParse(venta['fecha'] as String? ?? '');
    final fechaTexto = fecha != null
        ? DateFormat('dd/MM/yyyy HH:mm').format(fecha.toLocal())
        : '';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AetherTheme.sandLight,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        title: Text('Compra confirmada',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Venta #${venta['idVenta']}',
                style: GoogleFonts.sourceSerif4(fontSize: 14)),
            if (fechaTexto.isNotEmpty)
              Text(fechaTexto,
                  style: GoogleFonts.outfit(
                      fontSize: 12, color: AetherTheme.muted)),
            const SizedBox(height: 8),
            Text(
              'Total: \$${(venta['total'] as num).toStringAsFixed(2)}',
              style: GoogleFonts.sourceSerif4(
                  fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final hasPromotions =
        appState.currentUser?.hasFeature('promociones') == true;
    final hasLoyalty = appState.currentUser?.hasFeature('fidelizacion') == true;
    final cobrando = _status == _CheckoutStatus.cobrando;
    final cobradoSinVenta = _status == _CheckoutStatus.cobradoSinVenta;
    final offlineQuote = !appState.isOnline ? _quoteOffline(appState) : null;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: AetherTheme.sandLight,
        borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Bolsa de Compras (${appState.totalCartCount})',
                    style: GoogleFonts.outfit(
                        fontSize: 16, fontWeight: FontWeight.w600)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AetherTheme.border),

          // Items list
          Expanded(
            child: appState.cart.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.shopping_bag_outlined,
                            size: 48, color: AetherTheme.border),
                        const SizedBox(height: 12),
                        Text('Tu bolsa está vacía.',
                            style: GoogleFonts.sourceSerif4(
                                fontSize: 14, color: AetherTheme.muted)),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: appState.cart.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = appState.cart[index];
                      return Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: SizedBox(
                              width: 60,
                              height: 75,
                              child: CachedNetworkImage(
                                  imageUrl: item.product.imageUrl,
                                  fit: BoxFit.cover),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.product.name,
                                    style: GoogleFonts.sourceSerif4(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600)),
                                Text(
                                    'Talla: ${item.size} • Color: ${item.product.colorName}',
                                    style: GoogleFonts.outfit(
                                        fontSize: 10,
                                        color: AetherTheme.muted)),
                                const SizedBox(height: 4),
                                Text('\$${item.product.price.toInt()}',
                                    style: GoogleFonts.sourceSerif4(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                          Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.remove, size: 16),
                                onPressed: cobrando
                                    ? null
                                    : () =>
                                        appState.updateCartQuantity(index, -1),
                              ),
                              Text('${item.quantity}',
                                  style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.add, size: 16),
                                onPressed: cobrando
                                    ? null
                                    : () =>
                                        appState.updateCartQuantity(index, 1),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
          ),

          // Footer
          if (appState.cart.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(
                    top: BorderSide(color: AetherTheme.border, width: 0.5)),
              ),
              child: Column(
                children: [
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _errorMessage!,
                        style: GoogleFonts.outfit(
                            fontSize: 11, color: Colors.red.shade700),
                      ),
                    ),
                  if (!appState.isOnline) ...[
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8),
                      child: Text(
                          'Sin conexión: tu compra se guarda en el teléfono y se registra al reconectarte. El pago es en efectivo al retirar en la sucursal.'),
                    ),
                    if (_sucursales.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: Text(
                            'Conectate una vez para descargar las sucursales.'),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: DropdownButtonFormField<int>(
                          initialValue: _codigoSucursalOffline,
                          isExpanded: true,
                          decoration: const InputDecoration(
                              labelText: 'Sucursal de retiro', isDense: true),
                          items: _sucursales
                              .map((s) => DropdownMenuItem(
                                    value: s.codigoSucursal,
                                    child: Text(s.nombre,
                                        overflow: TextOverflow.ellipsis),
                                  ))
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _codigoSucursalOffline = value),
                        ),
                      ),
                  ],
                  if (appState.isOnline) ...[
                    if (hasPromotions)
                      TextField(
                        controller: _couponController,
                        decoration: const InputDecoration(
                            labelText: 'Código de cupón', isDense: true),
                        onChanged: (_) => setState(() => _quote = null),
                      ),
                    if (hasLoyalty)
                      TextField(
                        controller: _pointsController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Puntos a canjear', isDense: true),
                        onChanged: (_) => setState(() => _quote = null),
                      ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _quoteLoading
                            ? null
                            : () => _actualizarCotizacion(appState),
                        child: Text(_quoteLoading
                            ? 'Calculando…'
                            : 'Aplicar y ver total'),
                      ),
                    ),
                  ] else if (hasPromotions || hasLoyalty)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 10),
                      child: Text(
                          'Los cupones y el canje de puntos requieren conexión. Se aplican solo las promociones guardadas.'),
                    ),
                  if (_quote != null && appState.isOnline) ...[
                    _QuoteSubtotalRow(value: _quote!.subtotal),
                    if (hasLoyalty && _quote!.cuenta != null)
                      Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                              'Saldo disponible: ${_quote!.cuenta!.saldo} puntos (${_quote!.cuenta!.nivel})')),
                    if (hasPromotions)
                      _QuoteDiscountRow(
                          label: 'Promociones',
                          value: _quote!.descuentoPromociones),
                    if (hasPromotions)
                      _QuoteDiscountRow(
                          label: 'Cupón', value: _quote!.descuentoCupon),
                    if (hasLoyalty)
                      _QuoteDiscountRow(
                          label: 'Puntos', value: _quote!.descuentoPuntos),
                    for (final aviso in _quote!.avisos)
                      Align(
                          alignment: Alignment.centerLeft,
                          child: Text(aviso,
                              style: GoogleFonts.outfit(
                                  fontSize: 10, color: AetherTheme.muted))),
                  ],
                  if (hasPromotions &&
                      offlineQuote != null &&
                      offlineQuote.descuentoPromociones > 0) ...[
                    _QuoteSubtotalRow(value: offlineQuote.subtotal),
                    _QuoteDiscountRow(
                        label: 'Promociones guardadas',
                        value: offlineQuote.descuentoPromociones),
                  ],
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                          _quote != null && appState.isOnline
                              ? 'Total cotizado'
                              : 'Total',
                          style: GoogleFonts.outfit(fontSize: 14)),
                      Text(
                          '\$${(_quote?.total ?? (offlineQuote?.total ?? appState.cartSubtotal)).toStringAsFixed(2)}',
                          style: GoogleFonts.sourceSerif4(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AetherTheme.charcoalDark,
                        foregroundColor: AetherTheme.sandLight,
                        shape: const RoundedRectangleBorder(
                            borderRadius: BorderRadius.zero),
                      ),
                      onPressed: cobrando || _guardandoOffline
                          ? null
                          : !appState.isOnline
                              ? (_codigoSucursalOffline == null
                                  ? null
                                  : () => _comprarOffline(appState))
                              : cobradoSinVenta
                                  ? () => _reintentarVenta(appState)
                                  : () => _iniciarCheckout(appState),
                      child: cobrando || _guardandoOffline
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: AetherTheme.sandLight),
                            )
                          : Text(
                              !appState.isOnline
                                  ? 'COMPRAR SIN CONEXIÓN (EFECTIVO)'
                                  : cobradoSinVenta
                                      ? 'REINTENTAR REGISTRO'
                                      : 'FINALIZAR COMPRA',
                              style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.5),
                            ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _QuoteSubtotalRow extends StatelessWidget {
  const _QuoteSubtotalRow({required this.value});
  final double value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Subtotal'),
            Text('\$${value.toStringAsFixed(2)}')
          ],
        ),
      );
}

class _QuoteDiscountRow extends StatelessWidget {
  const _QuoteDiscountRow({required this.label, required this.value});
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [Text(label), Text('-\$${value.toStringAsFixed(2)}')],
        ),
      );
}
