/// Revenue analytics for the restaurant owner — aggregated across every branch
/// of the owner's restaurant. Backend derives the restaurant from the token,
/// so no ids are sent.
///
/// Backend shape (`GET /owner/stats?period=...` → `data`):
/// `{ period, revenue, ordersCount, avgCheck, cancelledCount, branchesCount,
///    byBranch: [ {branchId, branchName, revenue, ordersCount} ],
///    byMethod: { cash, card, transfer, kaspi, mixed },
///    topFoods: [ {name, qty, sum} ],
///    daily: [ {date: "YYYY-MM-DD", revenue} ] }`.
///
/// Revenue counts only PAID, non-cancelled orders.
class OwnerStats {
  final String period;
  final int revenue;
  final int ordersCount;
  final int avgCheck;
  final int cancelledCount;
  final int branchesCount;
  final List<BranchStat> byBranch;
  final PaymentBreakdown byMethod;
  final List<TopFood> topFoods;
  final List<DailyPoint> daily;

  const OwnerStats({
    this.period = '',
    this.revenue = 0,
    this.ordersCount = 0,
    this.avgCheck = 0,
    this.cancelledCount = 0,
    this.branchesCount = 0,
    this.byBranch = const [],
    this.byMethod = const PaymentBreakdown(),
    this.topFoods = const [],
    this.daily = const [],
  });

  /// True when there were no sales in the period (drives the empty hint).
  bool get isEmpty => revenue == 0 && ordersCount == 0;

  factory OwnerStats.fromJson(Map<String, dynamic> json) {
    return OwnerStats(
      period: (json['period'] ?? '').toString(),
      revenue: _toInt(json['revenue']),
      ordersCount: _toInt(json['ordersCount']),
      avgCheck: _toInt(json['avgCheck']),
      cancelledCount: _toInt(json['cancelledCount']),
      branchesCount: _toInt(json['branchesCount']),
      byBranch: _list(json['byBranch'], BranchStat.fromJson),
      byMethod: PaymentBreakdown.fromJson(json['byMethod']),
      topFoods: _list(json['topFoods'], TopFood.fromJson),
      daily: _list(json['daily'], DailyPoint.fromJson),
    );
  }

  static List<T> _list<T>(
    dynamic value,
    T Function(Map<String, dynamic>) build,
  ) {
    if (value is! List) return const [];
    final out = <T>[];
    for (final e in value) {
      if (e is Map) out.add(build(e.cast<String, dynamic>()));
    }
    return out;
  }
}

/// One branch's contribution. Server sorts these desc by [revenue].
class BranchStat {
  final String branchId;
  final String branchName;
  final int revenue;
  final int ordersCount;

  const BranchStat({
    this.branchId = '',
    this.branchName = '',
    this.revenue = 0,
    this.ordersCount = 0,
  });

  factory BranchStat.fromJson(Map<String, dynamic> json) {
    return BranchStat(
      branchId: (json['branchId'] ?? json['_id'] ?? '').toString(),
      branchName: (json['branchName'] ?? json['name'] ?? '').toString(),
      revenue: _toInt(json['revenue']),
      ordersCount: _toInt(json['ordersCount']),
    );
  }
}

/// Revenue split by payment method. All figures are whole tenge.
class PaymentBreakdown {
  final int cash;
  final int card;
  final int transfer;
  final int kaspi;
  final int mixed;

  const PaymentBreakdown({
    this.cash = 0,
    this.card = 0,
    this.transfer = 0,
    this.kaspi = 0,
    this.mixed = 0,
  });

  factory PaymentBreakdown.fromJson(dynamic value) {
    if (value is! Map) return const PaymentBreakdown();
    return PaymentBreakdown(
      cash: _toInt(value['cash']),
      card: _toInt(value['card']),
      transfer: _toInt(value['transfer']),
      kaspi: _toInt(value['kaspi']),
      mixed: _toInt(value['mixed']),
    );
  }
}

/// A best-selling dish line.
class TopFood {
  final String name;
  final int qty;
  final int sum;

  const TopFood({this.name = '', this.qty = 0, this.sum = 0});

  factory TopFood.fromJson(Map<String, dynamic> json) {
    return TopFood(
      name: (json['name'] ?? '').toString(),
      qty: _toInt(json['qty']),
      sum: _toInt(json['sum']),
    );
  }
}

/// A single day on the revenue timeline.
class DailyPoint {
  final String date; // "YYYY-MM-DD"
  final int revenue;

  const DailyPoint({this.date = '', this.revenue = 0});

  factory DailyPoint.fromJson(Map<String, dynamic> json) {
    return DailyPoint(
      date: (json['date'] ?? '').toString(),
      revenue: _toInt(json['revenue']),
    );
  }
}

/// Tolerant int parse shared by the owner-stats models.
int _toInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
