import 'dart:convert';

import 'package:aether_fashion/data/offline_database.dart';
import 'package:aether_fashion/services/notification_service.dart';
import 'package:aether_fashion/services/smart_notifications.dart';
import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:flutter_test/flutter_test.dart';

class _Scheduled {
  _Scheduled(this.id, this.at, this.title, this.body);
  final int id;
  final DateTime at;
  final String title;
  final String body;
}

class _FakeNotifier implements AppNotifier {
  final shown = <(int, String, String)>[];
  final scheduled = <_Scheduled>[];
  final cancelled = <int>[];
  bool cancelledAll = false;

  @override
  Future<void> show(int id, String title, String body) async =>
      shown.add((id, title, body));

  @override
  Future<void> schedule(int id, DateTime at, String title, String body) async =>
      scheduled.add(_Scheduled(id, at, title, body));

  @override
  Future<void> cancel(int id) async => cancelled.add(id);

  @override
  Future<void> cancelAll() async => cancelledAll = true;
}

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  final now = DateTime(2026, 11, 10, 9);
  late OfflineDatabase database;
  late _FakeNotifier notifier;
  late SmartNotifications notifications;

  setUp(() async {
    database = OfflineDatabase.memory(scopeKey: 'empresa-4-user-6');
    notifier = _FakeNotifier();
    notifications = SmartNotifications(notifier, clock: () => now);
    await database.putRow('cliente', {'idCliente': 2});
    await database
        .putRow('productos', {'idProducto': 10, 'nombre': 'Camisa Lino'});
    await database.putRow(
        'sucursales', {'codigoSucursal': 3, 'nombre': 'Sucursal Centro'});
  });

  tearDown(() async => database.close());

  Future<void> putReservation(int code, String state,
          {String fecha = '2026-11-12', String horario = '15:00:00'}) =>
      database.putRow('reservas', {
        'codigoReserva': code,
        'estado': state,
        'fecha': fecha,
        'horario': horario,
        'idProducto': 10,
        'codigoSucursal': 3,
      });

  group('abandoned cart', () {
    test('schedules a reminder two hours later with the item count', () async {
      await notifications.cartChanged(3);

      final reminder = notifier.scheduled.single;
      expect(reminder.id, SmartNotifications.cartReminderId);
      expect(reminder.at, now.add(const Duration(hours: 2)));
      expect(reminder.body, contains('Dejaste 3 prendas'));
    });

    test('an empty bag cancels the reminder', () async {
      await notifications.cartChanged(0);

      expect(notifier.scheduled, isEmpty);
      expect(notifier.cancelled, [SmartNotifications.cartReminderId]);
    });
  });

  group('reservation reminders', () {
    test('schedules the day before and one hour before an active reservation',
        () async {
      await putReservation(7, 'Pendiente');

      await notifications.rescheduleFromCache(database);

      expect(notifier.scheduled.map((s) => s.at), [
        DateTime(2026, 11, 11, 15),
        DateTime(2026, 11, 12, 14),
      ]);
      expect(notifier.scheduled.first.body,
          'Mañana a las 15:00 retirás Camisa Lino en Sucursal Centro.');
    });

    test('skips finished, cancelled and past reservations', () async {
      await putReservation(7, 'Confirmada');
      await putReservation(8, 'Cancelada');
      await putReservation(9, 'Pendiente', fecha: '2026-11-09');

      await notifications.rescheduleFromCache(database);

      expect(notifier.scheduled, isEmpty);
    });

    test('only the one-hour reminder when the day-before moment passed',
        () async {
      await putReservation(7, 'Preparada en Sucursal', fecha: '2026-11-10');

      await notifications.rescheduleFromCache(database);

      expect(notifier.scheduled.single.at, DateTime(2026, 11, 10, 14));
    });

    test('rescheduling cancels the previously scheduled reminders', () async {
      await putReservation(7, 'Pendiente');
      await notifications.rescheduleFromCache(database);
      final first = notifier.scheduled.map((s) => s.id).toList();

      await notifications.rescheduleFromCache(database);

      expect(notifier.cancelled, first);
    });

    test('staff accounts (no customer profile) get no reminders', () async {
      await database.replaceRows('cliente', []);
      await putReservation(7, 'Pendiente');

      await notifications.rescheduleFromCache(database);

      expect(notifier.scheduled, isEmpty);
    });
  });

  test('a promotion is announced three hours before it ends', () async {
    await database.writeMetadata(
        'active_promotions',
        jsonEncode([
          {
            'idPromocion': 4,
            'nombre': 'Verano 20%',
            'fecha_fin': DateTime(2026, 11, 10, 23).toUtc().toIso8601String(),
          }
        ]));

    await notifications.rescheduleFromCache(database);

    final notice = notifier.scheduled.single;
    expect(notice.at, DateTime(2026, 11, 10, 20));
    expect(notice.body, '«Verano 20%» termina a las 23:00. ¡Aprovechala!');
  });

  group('reservation status changes', () {
    test('notifies when the store prepares the reservation', () async {
      await putReservation(7, 'Pendiente');
      final before = await notifications.reservationStates(database);
      await putReservation(7, 'Preparada en Sucursal');

      await notifications.reservationChanges(database, before);

      expect(notifier.shown.single.$2, '¡Tu reserva está lista!');
      expect(notifier.shown.single.$3,
          'Tu reserva #7 ya está preparada para retirar en Sucursal Centro.');
    });

    test('the first download notifies nothing', () async {
      await putReservation(7, 'Preparada en Sucursal');

      await notifications.reservationChanges(database, {});

      expect(notifier.shown, isEmpty);
    });
  });

  test('only promotions missing from the previous snapshot are announced',
      () async {
    await database.writeMetadata(
        'active_promotions',
        jsonEncode([
          {'idPromocion': 1, 'nombre': 'Vieja'},
          {'idPromocion': 2, 'nombre': 'Camisas 2x1'},
        ]));

    await notifications.newPromotions(database, null);
    expect(notifier.shown, isEmpty);

    await notifications.newPromotions(database, {1});
    expect(notifier.shown.single.$3,
        '«Camisas 2x1» ya está disponible. ¡Mirala en el catálogo!');
  });

  group('loyalty', () {
    test('the first summary is only stored', () async {
      await notifications.loyalty(database, {'saldo': 100, 'nivel': 'Bronce'});

      expect(notifier.shown, isEmpty);
    });

    test('notifies points earned', () async {
      await notifications.loyalty(database, {'saldo': 100, 'nivel': 'Bronce'});
      await notifications.loyalty(database, {'saldo': 125, 'nivel': 'Bronce'});

      expect(notifier.shown.single.$2, 'Ganaste 25 puntos');
    });

    test('a level up wins over the points message', () async {
      await notifications.loyalty(database, {'saldo': 1990, 'nivel': 'Bronce'});
      await notifications.loyalty(database, {'saldo': 2015, 'nivel': 'Plata'});

      expect(notifier.shown.single.$2, '¡Subiste a nivel Plata!');
    });

    test('spending points notifies nothing', () async {
      await notifications.loyalty(database, {'saldo': 300, 'nivel': 'Plata'});
      await notifications.loyalty(database, {'saldo': 100, 'nivel': 'Plata'});

      expect(notifier.shown, isEmpty);
    });
  });

  test('offline purchase results become notifications', () async {
    await notifications.purchaseResults([
      {'comprobanteLocal': 'APP-1', 'syncStatus': 'synced', 'idVenta': 55},
      {
        'comprobanteLocal': 'APP-2',
        'syncStatus': 'rejected',
        'syncReason': 'La sucursal elegida no tiene uno de los productos.'
      },
    ]);

    expect(notifier.shown.map((n) => n.$2),
        ['Compra registrada', 'No pudimos registrar tu compra']);
    expect(notifier.shown.first.$3, contains('Venta #55'));
  });

  test('logout cancels every notification', () async {
    await notifications.cancelAll();
    expect(notifier.cancelledAll, isTrue);
  });
}
