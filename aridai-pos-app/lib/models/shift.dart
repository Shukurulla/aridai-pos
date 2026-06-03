/// A cash-register shift as returned by `GET /shifts/all/<branchId>`.
///
/// Backend shape:
/// `{ _id, isActive, shiftNumber, openedAt, closedAt,
///    openingCash, closingCash, closingDiscrepancy,
///    totals: { ordersCount, revenue, cashRevenue, cardRevenue, ... } }`.
class ShiftModel {
  final String id;
  final bool isActive;
  final int? shiftNumber;
  final DateTime? openedAt;
  final DateTime? closedAt;
  final num openingCash;
  final num? closingCash;
  final num? closingDiscrepancy;
  final num revenue;
  final int ordersCount;
  final num cashRevenue;
  final num cardRevenue;

  const ShiftModel({
    required this.id,
    this.isActive = false,
    this.shiftNumber,
    this.openedAt,
    this.closedAt,
    this.openingCash = 0,
    this.closingCash,
    this.closingDiscrepancy,
    this.revenue = 0,
    this.ordersCount = 0,
    this.cashRevenue = 0,
    this.cardRevenue = 0,
  });

  factory ShiftModel.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'];
    num revenue = 0;
    int ordersCount = 0;
    num cashRevenue = 0;
    num cardRevenue = 0;
    if (totals is Map) {
      revenue = _toNum(totals['revenue']);
      ordersCount = _toInt(totals['ordersCount']);
      cashRevenue = _toNum(totals['cashRevenue']);
      cardRevenue = _toNum(totals['cardRevenue']);
    }

    return ShiftModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      isActive: json['isActive'] == true,
      shiftNumber: _toIntOrNull(json['shiftNumber']),
      openedAt: _toDate(json['openedAt']),
      closedAt: _toDate(json['closedAt']),
      openingCash: _toNum(json['openingCash']),
      closingCash: json['closingCash'] == null
          ? null
          : _toNum(json['closingCash']),
      closingDiscrepancy: json['closingDiscrepancy'] == null
          ? null
          : _toNum(json['closingDiscrepancy']),
      revenue: revenue,
      ordersCount: ordersCount,
      cashRevenue: cashRevenue,
      cardRevenue: cardRevenue,
    );
  }

  static num _toNum(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static int? _toIntOrNull(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  static DateTime? _toDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
