import 'dart:convert';

import '../data/offline_database.dart';
import 'notification_service.dart';

/// Decides which local notifications to show or schedule, using only data the
/// app already keeps in SQLite. Two kinds:
///
/// * Scheduled (fire even with the app closed): reservation reminders,
///   abandoned cart and promotions about to end.
/// * Detected on sync (the app compares the data before and after a sync):
///   offline purchases/reservations synced or rejected, reservation status
///   changes, new promotions, points earned and level ups.
class SmartNotifications {
  SmartNotifications(this._notifier, {DateTime Function()? clock})
      : _clock = clock ?? DateTime.now;

  final AppNotifier _notifier;
  final DateTime Function() _clock;

  static const cartReminderDelay = Duration(hours: 2);
  static const promotionEndingNotice = Duration(hours: 3);

  static const cartReminderId = 1;
  static const _reminderBase = 100000;
  static const _promotionEndingBase = 200000;
  static const _syncResultBase = 300000;
  static const _reservationStatusBase = 400000;
  static const _newPromotionBase = 500000;
  static const _pointsId = 600001;
  static const _levelId = 600002;

  static const _scheduledIdsKey = 'scheduled_notification_ids';
  static const _loyaltyKey = 'loyalty_snapshot';
  static const activeReservationStates = {'Pendiente', 'Preparada en Sucursal'};
  static const _levels = ['Bronce', 'Plata', 'Oro'];

  /// Logout: nothing of the previous account may fire later.
  Future<void> cancelAll() => _notifier.cancelAll();

  // --- Scheduled -------------------------------------------------------

  /// Abandoned cart: one pending reminder while the bag has items.
  Future<void> cartChanged(int itemCount) async {
    if (itemCount <= 0) {
      await _notifier.cancel(cartReminderId);
      return;
    }
    await _notifier.schedule(
      cartReminderId,
      _clock().add(cartReminderDelay),
      'Tu bolsa te espera',
      itemCount == 1
          ? 'Dejaste 1 prenda en tu bolsa. ¡Completá tu compra!'
          : 'Dejaste $itemCount prendas en tu bolsa. ¡Completá tu compra!',
    );
  }

  /// Replaces every reservation reminder and "promotion ends today" notice
  /// with the ones that match the data currently cached.
  Future<void> rescheduleFromCache(OfflineDatabase database) async {
    final previous = await _readIds(database);
    for (final id in previous) {
      await _notifier.cancel(id);
    }

    final now = _clock();
    final scheduled = <int>[];
    Future<void> plan(int id, DateTime at, String title, String body) async {
      if (!at.isAfter(now)) return;
      await _notifier.schedule(id, at, title, body);
      scheduled.add(id);
    }

    if (await _isCustomer(database)) {
      final products = await _names(database, 'productos', 'idProducto');
      final branches = await _names(database, 'sucursales', 'codigoSucursal');
      for (final reservation in await database.readRows('reservas')) {
        final code = _int(reservation['codigoReserva']);
        final pickup = reservationPickup(reservation);
        if (code == null ||
            pickup == null ||
            !activeReservationStates.contains(reservation['estado'])) {
          continue;
        }
        final product =
            products[_int(reservation['idProducto'])] ?? 'tu prenda';
        final branch =
            branches[_int(reservation['codigoSucursal'])] ?? 'la sucursal';
        final hour = _hhmm(pickup);
        await plan(
          _reminderBase + code * 2,
          pickup.subtract(const Duration(days: 1)),
          'Recordatorio de reserva',
          'Mañana a las $hour retirás $product en $branch.',
        );
        await plan(
          _reminderBase + code * 2 + 1,
          pickup.subtract(const Duration(hours: 1)),
          'Tu retiro es en 1 hora',
          'A las $hour te esperamos en $branch para retirar $product.',
        );
      }
    }

    for (final promotion in await _promotions(database)) {
      final id = _int(promotion['idPromocion']);
      final end = _date(promotion['fecha_fin'] ?? promotion['fechaFin']);
      if (id == null || end == null) continue;
      await plan(
        _promotionEndingBase + id,
        end.subtract(promotionEndingNotice),
        'La promoción termina hoy',
        '«${promotion['nombre'] ?? 'Promoción'}» termina a las ${_hhmm(end)}. ¡Aprovechala!',
      );
    }

    await database.writeMetadata(_scheduledIdsKey, jsonEncode(scheduled));
  }

  // --- Detected on sync ------------------------------------------------

  /// Offline purchases sent by [OfflinePurchasesService.pushPending].
  Future<void> purchaseResults(List<Map<String, dynamic>> results) async {
    for (final result in results) {
      final receipt = result['comprobanteLocal'];
      final id = _syncResultBase + receipt.hashCode.abs() % 100000;
      if (result['syncStatus'] == 'synced') {
        final sale = result['idVenta'];
        await _notifier.show(
          id,
          'Compra registrada',
          sale == null
              ? 'Tu compra $receipt se registró. Pagás en efectivo al retirar.'
              : 'Tu compra $receipt se registró como Venta #$sale. Pagás en efectivo al retirar.',
        );
      } else if (result['syncStatus'] == 'rejected') {
        await _notifier.show(id, 'No pudimos registrar tu compra',
            '$receipt: ${result['syncReason'] ?? 'fue rechazada.'}');
      }
    }
  }

  /// Offline reservations answered by `POST /api/sync/push`.
  Future<void> reservationSyncResult(
      Map<String, dynamic> reservation, String status) async {
    final id = _syncResultBase + reservation['idLocal'].hashCode.abs() % 100000;
    if (status == 'synced') {
      await _notifier.show(id, 'Reserva registrada',
          'Tu reserva sin conexión para el ${reservation['fecha']} ya está en el sistema.');
    } else if (status == 'conflict' || status == 'rejected') {
      await _notifier.show(id, 'No pudimos registrar tu reserva',
          'Tu reserva para el ${reservation['fecha']} no se pudo guardar. Revisala en Mis reservas.');
    }
  }

  Future<Map<int, String>> reservationStates(OfflineDatabase database) async {
    final states = <int, String>{};
    for (final row in await database.readRows('reservas')) {
      final code = _int(row['codigoReserva']);
      final state = row['estado'];
      if (code != null && state is String) states[code] = state;
    }
    return states;
  }

  /// Notifies the reservations whose status the store changed since [before].
  /// Reservations the app did not know yet (first sync) are not notified.
  Future<void> reservationChanges(
      OfflineDatabase database, Map<int, String> before) async {
    if (before.isEmpty || !await _isCustomer(database)) return;
    final branches = await _names(database, 'sucursales', 'codigoSucursal');
    for (final row in await database.readRows('reservas')) {
      final code = _int(row['codigoReserva']);
      final state = row['estado'];
      if (code == null || state is! String) continue;
      final previous = before[code];
      if (previous == null || previous == state) continue;
      final branch = branches[_int(row['codigoSucursal'])] ?? 'la sucursal';
      final message = switch (state) {
        'Preparada en Sucursal' => (
            '¡Tu reserva está lista!',
            'Tu reserva #$code ya está preparada para retirar en $branch.'
          ),
        'Confirmada' => (
            'Reserva retirada',
            'Retiraste tu reserva #$code. ¡Gracias por tu compra!'
          ),
        'Cancelada' => (
            'Reserva cancelada',
            'Tu reserva #$code fue cancelada.'
          ),
        _ => ('Tu reserva cambió', 'Tu reserva #$code ahora está: $state.'),
      };
      await _notifier.show(
          _reservationStatusBase + code, message.$1, message.$2);
    }
  }

  Future<Set<int>> promotionIds(OfflineDatabase database) async => {
        for (final promotion in await _promotions(database))
          if (_int(promotion['idPromocion']) != null)
            _int(promotion['idPromocion'])!,
      };

  /// Notifies promotions that were not in the previous snapshot. Nothing is
  /// notified on the first download ([before] is null).
  Future<void> newPromotions(OfflineDatabase database, Set<int>? before) async {
    if (before == null) return;
    for (final promotion in await _promotions(database)) {
      final id = _int(promotion['idPromocion']);
      if (id == null || before.contains(id)) continue;
      await _notifier.show(_newPromotionBase + id, 'Nueva promoción',
          '«${promotion['nombre'] ?? 'Promoción'}» ya está disponible. ¡Mirala en el catálogo!');
    }
  }

  /// Compares `GET /api/loyalty/me` with the last summary seen.
  Future<void> loyalty(
      OfflineDatabase database, Map<String, dynamic> summary) async {
    final balance = _int(summary['saldo']);
    final level = summary['nivel'];
    if (balance == null || level is! String) return;
    final raw = await database.readMetadata(_loyaltyKey);
    await database.writeMetadata(
        _loyaltyKey, jsonEncode({'saldo': balance, 'nivel': level}));
    if (raw == null) return;
    final previous = Map<String, dynamic>.from(jsonDecode(raw) as Map);
    final previousBalance = _int(previous['saldo']) ?? balance;
    final previousLevel = previous['nivel'];
    if (_levels.indexOf(level) > _levels.indexOf('$previousLevel')) {
      await _notifier.show(_levelId, '¡Subiste a nivel $level!',
          'Ahora ganás más puntos en cada compra. Saldo: $balance puntos.');
    } else if (balance > previousBalance) {
      await _notifier.show(
          _pointsId,
          'Ganaste ${balance - previousBalance} puntos',
          'Tu saldo ahora es de $balance puntos (nivel $level).');
    }
  }

  // --- Helpers ---------------------------------------------------------

  /// Pickup moment of a reservation (`fecha` YYYY-MM-DD + `horario` HH:MM[:SS]).
  static DateTime? reservationPickup(Map<String, dynamic> reservation) {
    final date = DateTime.tryParse('${reservation['fecha']}');
    final parts = '${reservation['horario']}'.split(':');
    if (date == null || parts.length < 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return DateTime(date.year, date.month, date.day, hour, minute);
  }

  Future<bool> _isCustomer(OfflineDatabase database) async =>
      (await database.readRows('cliente')).isNotEmpty;

  Future<List<Map<String, dynamic>>> _promotions(
      OfflineDatabase database) async {
    final raw = await database.readMetadata('active_promotions');
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<Map<int, String>> _names(
      OfflineDatabase database, String collection, String key) async {
    final names = <int, String>{};
    for (final row in await database.readRows(collection)) {
      final id = _int(row[key]);
      final name = row['nombre'];
      if (id != null && name is String && name.isNotEmpty) names[id] = name;
    }
    return names;
  }

  Future<List<int>> _readIds(OfflineDatabase database) async {
    final raw = await database.readMetadata(_scheduledIdsKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((id) => (id as num).toInt())
          .toList();
    } catch (_) {
      return [];
    }
  }

  static int? _int(Object? value) =>
      value is num ? value.toInt() : int.tryParse('${value ?? ''}');

  static DateTime? _date(Object? value) =>
      value == null ? null : DateTime.tryParse('$value')?.toLocal();

  static String _hhmm(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
}
