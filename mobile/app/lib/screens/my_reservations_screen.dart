import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../services/reservations_service.dart';
import '../providers/app_state.dart';
import '../theme/aether_theme.dart';

/// Mobile Fase 3: lista de reservas reales del Cliente autenticado
/// (`GET /api/reservations`, auto-escopado del lado del servidor).
class MyReservationsScreen extends StatefulWidget {
  const MyReservationsScreen({super.key});

  @override
  State<MyReservationsScreen> createState() => _MyReservationsScreenState();
}

class _MyReservationsScreenState extends State<MyReservationsScreen> {
  final ApiClient _api = ApiClient();
  late final ReservationsService _reservationsService =
      ReservationsService(_api);

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _reservas = [];
  AppState? _observedAppState;
  bool _wasSyncing = false;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final appState = context.read<AppState>();
    if (!identical(appState, _observedAppState)) {
      _observedAppState?.removeListener(_onAppStateChanged);
      _observedAppState = appState;
      _wasSyncing = appState.isSyncing;
      appState.addListener(_onAppStateChanged);
    }
  }

  void _onAppStateChanged() {
    final appState = _observedAppState;
    if (appState == null) return;
    final finishedSync = _wasSyncing && !appState.isSyncing;
    _wasSyncing = appState.isSyncing;
    if (finishedSync && mounted) _cargar();
  }

  @override
  void dispose() {
    _observedAppState?.removeListener(_onAppStateChanged);
    super.dispose();
  }

  Future<void> _cargar() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final reservas = await _reservationsService.getMisReservas();
      if (!mounted) return;
      setState(() {
        _reservas = reservas;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudieron cargar tus reservas.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AetherTheme.sandLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: AetherTheme.charcoalDark),
        title: Text('Mis Reservas',
            style: GoogleFonts.outfit(
                color: AetherTheme.charcoalDark, fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AetherTheme.charcoalDark))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                                fontSize: 12, color: Colors.red.shade700)),
                        const SizedBox(height: 12),
                        OutlinedButton(
                            onPressed: _cargar,
                            child: const Text('Reintentar')),
                      ],
                    ),
                  ),
                )
              : _reservas.isEmpty
                  ? Center(
                      child: Text('Todavia no tenes reservas.',
                          style: GoogleFonts.sourceSerif4(
                              fontSize: 14, color: AetherTheme.muted)),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _reservas.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final r = _reservas[index];
                        final syncStatus = r['syncStatus'] as String?;
                        final estado = switch (syncStatus) {
                          'pending' => 'PENDIENTE DE CONFIRMACIÓN',
                          'conflict' => 'CONFLICTO',
                          'rejected' => 'RECHAZADA',
                          _ => (r['estado'] as String? ?? '').toUpperCase(),
                        };
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.7),
                            border: Border.all(
                                color: AetherTheme.border
                                    .withValues(alpha: 0.6)),
                            borderRadius: BorderRadius.circular(2),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    r['producto_nombre'] as String? ??
                                        'Producto #${r['idProducto']}',
                                    style: GoogleFonts.sourceSerif4(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                        color: AetherTheme.surface,
                                        borderRadius: BorderRadius.circular(2)),
                                    child: Text(
                                      estado,
                                      style: GoogleFonts.outfit(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: AetherTheme.muted),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${r['fecha']} • ${r['horario']}',
                                style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: AetherTheme.muted),
                              ),
                              if (r['sucursal_nombre'] != null)
                                Text(
                                  r['sucursal_nombre'] as String,
                                  style: GoogleFonts.outfit(
                                      fontSize: 11,
                                      color: AetherTheme.muted),
                                ),
                              if (syncStatus == 'conflict' ||
                                  syncStatus == 'rejected') ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Motivo: ${r['syncReason'] ?? 'No especificado'}',
                                  style: GoogleFonts.outfit(
                                      fontSize: 11, color: Colors.red.shade700),
                                ),
                              ],
                              if (r['montoDeposito'] != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Deposito: \$${(r['montoDeposito'] as num).toStringAsFixed(2)}',
                                  style: GoogleFonts.sourceSerif4(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
