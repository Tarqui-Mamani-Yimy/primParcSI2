// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'offline_database.dart';

// ignore_for_file: type=lint
class $ProductosCacheTable extends ProductosCache
    with TableInfo<$ProductosCacheTable, ProductosCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ProductosCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'productos_cache';
  @override
  VerificationContext validateIntegrity(Insertable<ProductosCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ProductosCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ProductosCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $ProductosCacheTable createAlias(String alias) {
    return $ProductosCacheTable(attachedDatabase, alias);
  }
}

class ProductosCacheData extends DataClass
    implements Insertable<ProductosCacheData> {
  final String id;
  final String payload;
  const ProductosCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  ProductosCacheCompanion toCompanion(bool nullToAbsent) {
    return ProductosCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory ProductosCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ProductosCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  ProductosCacheData copyWith({String? id, String? payload}) =>
      ProductosCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  ProductosCacheData copyWithCompanion(ProductosCacheCompanion data) {
    return ProductosCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ProductosCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ProductosCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class ProductosCacheCompanion extends UpdateCompanion<ProductosCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const ProductosCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ProductosCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<ProductosCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ProductosCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return ProductosCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ProductosCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SucursalesCacheTable extends SucursalesCache
    with TableInfo<$SucursalesCacheTable, SucursalesCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SucursalesCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sucursales_cache';
  @override
  VerificationContext validateIntegrity(
      Insertable<SucursalesCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SucursalesCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SucursalesCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $SucursalesCacheTable createAlias(String alias) {
    return $SucursalesCacheTable(attachedDatabase, alias);
  }
}

class SucursalesCacheData extends DataClass
    implements Insertable<SucursalesCacheData> {
  final String id;
  final String payload;
  const SucursalesCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  SucursalesCacheCompanion toCompanion(bool nullToAbsent) {
    return SucursalesCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory SucursalesCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SucursalesCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  SucursalesCacheData copyWith({String? id, String? payload}) =>
      SucursalesCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  SucursalesCacheData copyWithCompanion(SucursalesCacheCompanion data) {
    return SucursalesCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SucursalesCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SucursalesCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class SucursalesCacheCompanion extends UpdateCompanion<SucursalesCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const SucursalesCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SucursalesCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<SucursalesCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SucursalesCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return SucursalesCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SucursalesCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $InventarioCacheTable extends InventarioCache
    with TableInfo<$InventarioCacheTable, InventarioCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $InventarioCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'inventario_cache';
  @override
  VerificationContext validateIntegrity(
      Insertable<InventarioCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  InventarioCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return InventarioCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $InventarioCacheTable createAlias(String alias) {
    return $InventarioCacheTable(attachedDatabase, alias);
  }
}

class InventarioCacheData extends DataClass
    implements Insertable<InventarioCacheData> {
  final String id;
  final String payload;
  const InventarioCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  InventarioCacheCompanion toCompanion(bool nullToAbsent) {
    return InventarioCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory InventarioCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return InventarioCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  InventarioCacheData copyWith({String? id, String? payload}) =>
      InventarioCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  InventarioCacheData copyWithCompanion(InventarioCacheCompanion data) {
    return InventarioCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('InventarioCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is InventarioCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class InventarioCacheCompanion extends UpdateCompanion<InventarioCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const InventarioCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  InventarioCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<InventarioCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  InventarioCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return InventarioCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('InventarioCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReservasCacheTable extends ReservasCache
    with TableInfo<$ReservasCacheTable, ReservasCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReservasCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'reservas_cache';
  @override
  VerificationContext validateIntegrity(Insertable<ReservasCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ReservasCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReservasCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $ReservasCacheTable createAlias(String alias) {
    return $ReservasCacheTable(attachedDatabase, alias);
  }
}

class ReservasCacheData extends DataClass
    implements Insertable<ReservasCacheData> {
  final String id;
  final String payload;
  const ReservasCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  ReservasCacheCompanion toCompanion(bool nullToAbsent) {
    return ReservasCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory ReservasCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReservasCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  ReservasCacheData copyWith({String? id, String? payload}) =>
      ReservasCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  ReservasCacheData copyWithCompanion(ReservasCacheCompanion data) {
    return ReservasCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReservasCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReservasCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class ReservasCacheCompanion extends UpdateCompanion<ReservasCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const ReservasCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReservasCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<ReservasCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReservasCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return ReservasCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReservasCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $VentasCacheTable extends VentasCache
    with TableInfo<$VentasCacheTable, VentasCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VentasCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'ventas_cache';
  @override
  VerificationContext validateIntegrity(Insertable<VentasCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  VentasCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return VentasCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $VentasCacheTable createAlias(String alias) {
    return $VentasCacheTable(attachedDatabase, alias);
  }
}

class VentasCacheData extends DataClass implements Insertable<VentasCacheData> {
  final String id;
  final String payload;
  const VentasCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  VentasCacheCompanion toCompanion(bool nullToAbsent) {
    return VentasCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory VentasCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return VentasCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  VentasCacheData copyWith({String? id, String? payload}) => VentasCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  VentasCacheData copyWithCompanion(VentasCacheCompanion data) {
    return VentasCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('VentasCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VentasCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class VentasCacheCompanion extends UpdateCompanion<VentasCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const VentasCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VentasCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<VentasCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VentasCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return VentasCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('VentasCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ClienteCacheTable extends ClienteCache
    with TableInfo<$ClienteCacheTable, ClienteCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ClienteCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cliente_cache';
  @override
  VerificationContext validateIntegrity(Insertable<ClienteCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ClienteCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ClienteCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $ClienteCacheTable createAlias(String alias) {
    return $ClienteCacheTable(attachedDatabase, alias);
  }
}

class ClienteCacheData extends DataClass
    implements Insertable<ClienteCacheData> {
  final String id;
  final String payload;
  const ClienteCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  ClienteCacheCompanion toCompanion(bool nullToAbsent) {
    return ClienteCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory ClienteCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ClienteCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  ClienteCacheData copyWith({String? id, String? payload}) => ClienteCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  ClienteCacheData copyWithCompanion(ClienteCacheCompanion data) {
    return ClienteCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ClienteCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ClienteCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class ClienteCacheCompanion extends UpdateCompanion<ClienteCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const ClienteCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ClienteCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<ClienteCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ClienteCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return ClienteCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ClienteCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ComprasCacheTable extends ComprasCache
    with TableInfo<$ComprasCacheTable, ComprasCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ComprasCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [id, payload];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'compras_cache';
  @override
  VerificationContext validateIntegrity(Insertable<ComprasCacheData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ComprasCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ComprasCacheData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
    );
  }

  @override
  $ComprasCacheTable createAlias(String alias) {
    return $ComprasCacheTable(attachedDatabase, alias);
  }
}

class ComprasCacheData extends DataClass
    implements Insertable<ComprasCacheData> {
  final String id;
  final String payload;
  const ComprasCacheData({required this.id, required this.payload});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  ComprasCacheCompanion toCompanion(bool nullToAbsent) {
    return ComprasCacheCompanion(
      id: Value(id),
      payload: Value(payload),
    );
  }

  factory ComprasCacheData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ComprasCacheData(
      id: serializer.fromJson<String>(json['id']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'payload': serializer.toJson<String>(payload),
    };
  }

  ComprasCacheData copyWith({String? id, String? payload}) => ComprasCacheData(
        id: id ?? this.id,
        payload: payload ?? this.payload,
      );
  ComprasCacheData copyWithCompanion(ComprasCacheCompanion data) {
    return ComprasCacheData(
      id: data.id.present ? data.id.value : this.id,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ComprasCacheData(')
          ..write('id: $id, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ComprasCacheData &&
          other.id == this.id &&
          other.payload == this.payload);
}

class ComprasCacheCompanion extends UpdateCompanion<ComprasCacheData> {
  final Value<String> id;
  final Value<String> payload;
  final Value<int> rowid;
  const ComprasCacheCompanion({
    this.id = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ComprasCacheCompanion.insert({
    required String id,
    required String payload,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        payload = Value(payload);
  static Insertable<ComprasCacheData> custom({
    Expression<String>? id,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ComprasCacheCompanion copyWith(
      {Value<String>? id, Value<String>? payload, Value<int>? rowid}) {
    return ComprasCacheCompanion(
      id: id ?? this.id,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ComprasCacheCompanion(')
          ..write('id: $id, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OfflineMetaTable extends OfflineMeta
    with TableInfo<$OfflineMetaTable, OfflineMetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflineMetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
      'key', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
      'value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_meta';
  @override
  VerificationContext validateIntegrity(Insertable<OfflineMetaData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
          _keyMeta, key.isAcceptableOrUnknown(data['key']!, _keyMeta));
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
          _valueMeta, value.isAcceptableOrUnknown(data['value']!, _valueMeta));
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  OfflineMetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflineMetaData(
      key: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}key'])!,
      value: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}value'])!,
    );
  }

  @override
  $OfflineMetaTable createAlias(String alias) {
    return $OfflineMetaTable(attachedDatabase, alias);
  }
}

class OfflineMetaData extends DataClass implements Insertable<OfflineMetaData> {
  final String key;
  final String value;
  const OfflineMetaData({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  OfflineMetaCompanion toCompanion(bool nullToAbsent) {
    return OfflineMetaCompanion(
      key: Value(key),
      value: Value(value),
    );
  }

  factory OfflineMetaData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflineMetaData(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  OfflineMetaData copyWith({String? key, String? value}) => OfflineMetaData(
        key: key ?? this.key,
        value: value ?? this.value,
      );
  OfflineMetaData copyWithCompanion(OfflineMetaCompanion data) {
    return OfflineMetaData(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflineMetaData(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflineMetaData &&
          other.key == this.key &&
          other.value == this.value);
}

class OfflineMetaCompanion extends UpdateCompanion<OfflineMetaData> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const OfflineMetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OfflineMetaCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  })  : key = Value(key),
        value = Value(value);
  static Insertable<OfflineMetaData> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OfflineMetaCompanion copyWith(
      {Value<String>? key, Value<String>? value, Value<int>? rowid}) {
    return OfflineMetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OfflineMetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$OfflineDatabase extends GeneratedDatabase {
  _$OfflineDatabase(QueryExecutor e) : super(e);
  $OfflineDatabaseManager get managers => $OfflineDatabaseManager(this);
  late final $ProductosCacheTable productosCache = $ProductosCacheTable(this);
  late final $SucursalesCacheTable sucursalesCache =
      $SucursalesCacheTable(this);
  late final $InventarioCacheTable inventarioCache =
      $InventarioCacheTable(this);
  late final $ReservasCacheTable reservasCache = $ReservasCacheTable(this);
  late final $VentasCacheTable ventasCache = $VentasCacheTable(this);
  late final $ClienteCacheTable clienteCache = $ClienteCacheTable(this);
  late final $ComprasCacheTable comprasCache = $ComprasCacheTable(this);
  late final $OfflineMetaTable offlineMeta = $OfflineMetaTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
        productosCache,
        sucursalesCache,
        inventarioCache,
        reservasCache,
        ventasCache,
        clienteCache,
        comprasCache,
        offlineMeta
      ];
}

typedef $$ProductosCacheTableCreateCompanionBuilder = ProductosCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$ProductosCacheTableUpdateCompanionBuilder = ProductosCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$ProductosCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $ProductosCacheTable> {
  $$ProductosCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$ProductosCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $ProductosCacheTable> {
  $$ProductosCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$ProductosCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $ProductosCacheTable> {
  $$ProductosCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$ProductosCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $ProductosCacheTable,
    ProductosCacheData,
    $$ProductosCacheTableFilterComposer,
    $$ProductosCacheTableOrderingComposer,
    $$ProductosCacheTableAnnotationComposer,
    $$ProductosCacheTableCreateCompanionBuilder,
    $$ProductosCacheTableUpdateCompanionBuilder,
    (
      ProductosCacheData,
      BaseReferences<_$OfflineDatabase, $ProductosCacheTable,
          ProductosCacheData>
    ),
    ProductosCacheData,
    PrefetchHooks Function()> {
  $$ProductosCacheTableTableManager(
      _$OfflineDatabase db, $ProductosCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ProductosCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ProductosCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ProductosCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ProductosCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              ProductosCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$ProductosCacheTable, ProductosCacheData>(
                        table),
                    BaseReferences<_$OfflineDatabase, $ProductosCacheTable,
                        ProductosCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ProductosCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $ProductosCacheTable,
    ProductosCacheData,
    $$ProductosCacheTableFilterComposer,
    $$ProductosCacheTableOrderingComposer,
    $$ProductosCacheTableAnnotationComposer,
    $$ProductosCacheTableCreateCompanionBuilder,
    $$ProductosCacheTableUpdateCompanionBuilder,
    (
      ProductosCacheData,
      BaseReferences<_$OfflineDatabase, $ProductosCacheTable,
          ProductosCacheData>
    ),
    ProductosCacheData,
    PrefetchHooks Function()>;
typedef $$SucursalesCacheTableCreateCompanionBuilder = SucursalesCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$SucursalesCacheTableUpdateCompanionBuilder = SucursalesCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$SucursalesCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $SucursalesCacheTable> {
  $$SucursalesCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$SucursalesCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $SucursalesCacheTable> {
  $$SucursalesCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$SucursalesCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $SucursalesCacheTable> {
  $$SucursalesCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$SucursalesCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $SucursalesCacheTable,
    SucursalesCacheData,
    $$SucursalesCacheTableFilterComposer,
    $$SucursalesCacheTableOrderingComposer,
    $$SucursalesCacheTableAnnotationComposer,
    $$SucursalesCacheTableCreateCompanionBuilder,
    $$SucursalesCacheTableUpdateCompanionBuilder,
    (
      SucursalesCacheData,
      BaseReferences<_$OfflineDatabase, $SucursalesCacheTable,
          SucursalesCacheData>
    ),
    SucursalesCacheData,
    PrefetchHooks Function()> {
  $$SucursalesCacheTableTableManager(
      _$OfflineDatabase db, $SucursalesCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SucursalesCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SucursalesCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SucursalesCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SucursalesCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              SucursalesCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$SucursalesCacheTable, SucursalesCacheData>(
                        table),
                    BaseReferences<_$OfflineDatabase, $SucursalesCacheTable,
                        SucursalesCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SucursalesCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $SucursalesCacheTable,
    SucursalesCacheData,
    $$SucursalesCacheTableFilterComposer,
    $$SucursalesCacheTableOrderingComposer,
    $$SucursalesCacheTableAnnotationComposer,
    $$SucursalesCacheTableCreateCompanionBuilder,
    $$SucursalesCacheTableUpdateCompanionBuilder,
    (
      SucursalesCacheData,
      BaseReferences<_$OfflineDatabase, $SucursalesCacheTable,
          SucursalesCacheData>
    ),
    SucursalesCacheData,
    PrefetchHooks Function()>;
typedef $$InventarioCacheTableCreateCompanionBuilder = InventarioCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$InventarioCacheTableUpdateCompanionBuilder = InventarioCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$InventarioCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $InventarioCacheTable> {
  $$InventarioCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$InventarioCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $InventarioCacheTable> {
  $$InventarioCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$InventarioCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $InventarioCacheTable> {
  $$InventarioCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$InventarioCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $InventarioCacheTable,
    InventarioCacheData,
    $$InventarioCacheTableFilterComposer,
    $$InventarioCacheTableOrderingComposer,
    $$InventarioCacheTableAnnotationComposer,
    $$InventarioCacheTableCreateCompanionBuilder,
    $$InventarioCacheTableUpdateCompanionBuilder,
    (
      InventarioCacheData,
      BaseReferences<_$OfflineDatabase, $InventarioCacheTable,
          InventarioCacheData>
    ),
    InventarioCacheData,
    PrefetchHooks Function()> {
  $$InventarioCacheTableTableManager(
      _$OfflineDatabase db, $InventarioCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$InventarioCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$InventarioCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$InventarioCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              InventarioCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              InventarioCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$InventarioCacheTable, InventarioCacheData>(
                        table),
                    BaseReferences<_$OfflineDatabase, $InventarioCacheTable,
                        InventarioCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$InventarioCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $InventarioCacheTable,
    InventarioCacheData,
    $$InventarioCacheTableFilterComposer,
    $$InventarioCacheTableOrderingComposer,
    $$InventarioCacheTableAnnotationComposer,
    $$InventarioCacheTableCreateCompanionBuilder,
    $$InventarioCacheTableUpdateCompanionBuilder,
    (
      InventarioCacheData,
      BaseReferences<_$OfflineDatabase, $InventarioCacheTable,
          InventarioCacheData>
    ),
    InventarioCacheData,
    PrefetchHooks Function()>;
typedef $$ReservasCacheTableCreateCompanionBuilder = ReservasCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$ReservasCacheTableUpdateCompanionBuilder = ReservasCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$ReservasCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $ReservasCacheTable> {
  $$ReservasCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$ReservasCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $ReservasCacheTable> {
  $$ReservasCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$ReservasCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $ReservasCacheTable> {
  $$ReservasCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$ReservasCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $ReservasCacheTable,
    ReservasCacheData,
    $$ReservasCacheTableFilterComposer,
    $$ReservasCacheTableOrderingComposer,
    $$ReservasCacheTableAnnotationComposer,
    $$ReservasCacheTableCreateCompanionBuilder,
    $$ReservasCacheTableUpdateCompanionBuilder,
    (
      ReservasCacheData,
      BaseReferences<_$OfflineDatabase, $ReservasCacheTable, ReservasCacheData>
    ),
    ReservasCacheData,
    PrefetchHooks Function()> {
  $$ReservasCacheTableTableManager(
      _$OfflineDatabase db, $ReservasCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReservasCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReservasCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReservasCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ReservasCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              ReservasCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$ReservasCacheTable, ReservasCacheData>(table),
                    BaseReferences<_$OfflineDatabase, $ReservasCacheTable,
                        ReservasCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ReservasCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $ReservasCacheTable,
    ReservasCacheData,
    $$ReservasCacheTableFilterComposer,
    $$ReservasCacheTableOrderingComposer,
    $$ReservasCacheTableAnnotationComposer,
    $$ReservasCacheTableCreateCompanionBuilder,
    $$ReservasCacheTableUpdateCompanionBuilder,
    (
      ReservasCacheData,
      BaseReferences<_$OfflineDatabase, $ReservasCacheTable, ReservasCacheData>
    ),
    ReservasCacheData,
    PrefetchHooks Function()>;
typedef $$VentasCacheTableCreateCompanionBuilder = VentasCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$VentasCacheTableUpdateCompanionBuilder = VentasCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$VentasCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $VentasCacheTable> {
  $$VentasCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$VentasCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $VentasCacheTable> {
  $$VentasCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$VentasCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $VentasCacheTable> {
  $$VentasCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$VentasCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $VentasCacheTable,
    VentasCacheData,
    $$VentasCacheTableFilterComposer,
    $$VentasCacheTableOrderingComposer,
    $$VentasCacheTableAnnotationComposer,
    $$VentasCacheTableCreateCompanionBuilder,
    $$VentasCacheTableUpdateCompanionBuilder,
    (
      VentasCacheData,
      BaseReferences<_$OfflineDatabase, $VentasCacheTable, VentasCacheData>
    ),
    VentasCacheData,
    PrefetchHooks Function()> {
  $$VentasCacheTableTableManager(_$OfflineDatabase db, $VentasCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$VentasCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$VentasCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$VentasCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              VentasCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              VentasCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$VentasCacheTable, VentasCacheData>(table),
                    BaseReferences<_$OfflineDatabase, $VentasCacheTable,
                        VentasCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$VentasCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $VentasCacheTable,
    VentasCacheData,
    $$VentasCacheTableFilterComposer,
    $$VentasCacheTableOrderingComposer,
    $$VentasCacheTableAnnotationComposer,
    $$VentasCacheTableCreateCompanionBuilder,
    $$VentasCacheTableUpdateCompanionBuilder,
    (
      VentasCacheData,
      BaseReferences<_$OfflineDatabase, $VentasCacheTable, VentasCacheData>
    ),
    VentasCacheData,
    PrefetchHooks Function()>;
typedef $$ClienteCacheTableCreateCompanionBuilder = ClienteCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$ClienteCacheTableUpdateCompanionBuilder = ClienteCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$ClienteCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $ClienteCacheTable> {
  $$ClienteCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$ClienteCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $ClienteCacheTable> {
  $$ClienteCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$ClienteCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $ClienteCacheTable> {
  $$ClienteCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$ClienteCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $ClienteCacheTable,
    ClienteCacheData,
    $$ClienteCacheTableFilterComposer,
    $$ClienteCacheTableOrderingComposer,
    $$ClienteCacheTableAnnotationComposer,
    $$ClienteCacheTableCreateCompanionBuilder,
    $$ClienteCacheTableUpdateCompanionBuilder,
    (
      ClienteCacheData,
      BaseReferences<_$OfflineDatabase, $ClienteCacheTable, ClienteCacheData>
    ),
    ClienteCacheData,
    PrefetchHooks Function()> {
  $$ClienteCacheTableTableManager(
      _$OfflineDatabase db, $ClienteCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ClienteCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ClienteCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ClienteCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ClienteCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              ClienteCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$ClienteCacheTable, ClienteCacheData>(table),
                    BaseReferences<_$OfflineDatabase, $ClienteCacheTable,
                        ClienteCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ClienteCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $ClienteCacheTable,
    ClienteCacheData,
    $$ClienteCacheTableFilterComposer,
    $$ClienteCacheTableOrderingComposer,
    $$ClienteCacheTableAnnotationComposer,
    $$ClienteCacheTableCreateCompanionBuilder,
    $$ClienteCacheTableUpdateCompanionBuilder,
    (
      ClienteCacheData,
      BaseReferences<_$OfflineDatabase, $ClienteCacheTable, ClienteCacheData>
    ),
    ClienteCacheData,
    PrefetchHooks Function()>;
typedef $$ComprasCacheTableCreateCompanionBuilder = ComprasCacheCompanion
    Function({
  required String id,
  required String payload,
  Value<int> rowid,
});
typedef $$ComprasCacheTableUpdateCompanionBuilder = ComprasCacheCompanion
    Function({
  Value<String> id,
  Value<String> payload,
  Value<int> rowid,
});

class $$ComprasCacheTableFilterComposer
    extends Composer<_$OfflineDatabase, $ComprasCacheTable> {
  $$ComprasCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));
}

class $$ComprasCacheTableOrderingComposer
    extends Composer<_$OfflineDatabase, $ComprasCacheTable> {
  $$ComprasCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));
}

class $$ComprasCacheTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $ComprasCacheTable> {
  $$ComprasCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$ComprasCacheTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $ComprasCacheTable,
    ComprasCacheData,
    $$ComprasCacheTableFilterComposer,
    $$ComprasCacheTableOrderingComposer,
    $$ComprasCacheTableAnnotationComposer,
    $$ComprasCacheTableCreateCompanionBuilder,
    $$ComprasCacheTableUpdateCompanionBuilder,
    (
      ComprasCacheData,
      BaseReferences<_$OfflineDatabase, $ComprasCacheTable, ComprasCacheData>
    ),
    ComprasCacheData,
    PrefetchHooks Function()> {
  $$ComprasCacheTableTableManager(
      _$OfflineDatabase db, $ComprasCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ComprasCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ComprasCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ComprasCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ComprasCacheCompanion(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String payload,
            Value<int> rowid = const Value.absent(),
          }) =>
              ComprasCacheCompanion.insert(
            id: id,
            payload: payload,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$ComprasCacheTable, ComprasCacheData>(table),
                    BaseReferences<_$OfflineDatabase, $ComprasCacheTable,
                        ComprasCacheData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ComprasCacheTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $ComprasCacheTable,
    ComprasCacheData,
    $$ComprasCacheTableFilterComposer,
    $$ComprasCacheTableOrderingComposer,
    $$ComprasCacheTableAnnotationComposer,
    $$ComprasCacheTableCreateCompanionBuilder,
    $$ComprasCacheTableUpdateCompanionBuilder,
    (
      ComprasCacheData,
      BaseReferences<_$OfflineDatabase, $ComprasCacheTable, ComprasCacheData>
    ),
    ComprasCacheData,
    PrefetchHooks Function()>;
typedef $$OfflineMetaTableCreateCompanionBuilder = OfflineMetaCompanion
    Function({
  required String key,
  required String value,
  Value<int> rowid,
});
typedef $$OfflineMetaTableUpdateCompanionBuilder = OfflineMetaCompanion
    Function({
  Value<String> key,
  Value<String> value,
  Value<int> rowid,
});

class $$OfflineMetaTableFilterComposer
    extends Composer<_$OfflineDatabase, $OfflineMetaTable> {
  $$OfflineMetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
      column: $table.key, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get value => $composableBuilder(
      column: $table.value, builder: (column) => ColumnFilters(column));
}

class $$OfflineMetaTableOrderingComposer
    extends Composer<_$OfflineDatabase, $OfflineMetaTable> {
  $$OfflineMetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
      column: $table.key, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get value => $composableBuilder(
      column: $table.value, builder: (column) => ColumnOrderings(column));
}

class $$OfflineMetaTableAnnotationComposer
    extends Composer<_$OfflineDatabase, $OfflineMetaTable> {
  $$OfflineMetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$OfflineMetaTableTableManager extends RootTableManager<
    _$OfflineDatabase,
    $OfflineMetaTable,
    OfflineMetaData,
    $$OfflineMetaTableFilterComposer,
    $$OfflineMetaTableOrderingComposer,
    $$OfflineMetaTableAnnotationComposer,
    $$OfflineMetaTableCreateCompanionBuilder,
    $$OfflineMetaTableUpdateCompanionBuilder,
    (
      OfflineMetaData,
      BaseReferences<_$OfflineDatabase, $OfflineMetaTable, OfflineMetaData>
    ),
    OfflineMetaData,
    PrefetchHooks Function()> {
  $$OfflineMetaTableTableManager(_$OfflineDatabase db, $OfflineMetaTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflineMetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OfflineMetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OfflineMetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> key = const Value.absent(),
            Value<String> value = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OfflineMetaCompanion(
            key: key,
            value: value,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String key,
            required String value,
            Value<int> rowid = const Value.absent(),
          }) =>
              OfflineMetaCompanion.insert(
            key: key,
            value: value,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (
                    e.readTable<$OfflineMetaTable, OfflineMetaData>(table),
                    BaseReferences<_$OfflineDatabase, $OfflineMetaTable,
                        OfflineMetaData>(db, table, e)
                  ))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$OfflineMetaTableProcessedTableManager = ProcessedTableManager<
    _$OfflineDatabase,
    $OfflineMetaTable,
    OfflineMetaData,
    $$OfflineMetaTableFilterComposer,
    $$OfflineMetaTableOrderingComposer,
    $$OfflineMetaTableAnnotationComposer,
    $$OfflineMetaTableCreateCompanionBuilder,
    $$OfflineMetaTableUpdateCompanionBuilder,
    (
      OfflineMetaData,
      BaseReferences<_$OfflineDatabase, $OfflineMetaTable, OfflineMetaData>
    ),
    OfflineMetaData,
    PrefetchHooks Function()>;

class $OfflineDatabaseManager {
  final _$OfflineDatabase _db;
  $OfflineDatabaseManager(this._db);
  $$ProductosCacheTableTableManager get productosCache =>
      $$ProductosCacheTableTableManager(_db, _db.productosCache);
  $$SucursalesCacheTableTableManager get sucursalesCache =>
      $$SucursalesCacheTableTableManager(_db, _db.sucursalesCache);
  $$InventarioCacheTableTableManager get inventarioCache =>
      $$InventarioCacheTableTableManager(_db, _db.inventarioCache);
  $$ReservasCacheTableTableManager get reservasCache =>
      $$ReservasCacheTableTableManager(_db, _db.reservasCache);
  $$VentasCacheTableTableManager get ventasCache =>
      $$VentasCacheTableTableManager(_db, _db.ventasCache);
  $$ClienteCacheTableTableManager get clienteCache =>
      $$ClienteCacheTableTableManager(_db, _db.clienteCache);
  $$ComprasCacheTableTableManager get comprasCache =>
      $$ComprasCacheTableTableManager(_db, _db.comprasCache);
  $$OfflineMetaTableTableManager get offlineMeta =>
      $$OfflineMetaTableTableManager(_db, _db.offlineMeta);
}
