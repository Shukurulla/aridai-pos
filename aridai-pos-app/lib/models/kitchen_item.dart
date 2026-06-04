/// A single dish in the cook's kitchen queue.
///
/// Backend shape (one item of `GET /orders/kitchen/<branchId>` `data`):
/// `{ orderId, itemId, receiptNumber,
///    orderType ("dineIn"|"takeaway"|"delivery"),
///    tableNumber (int|null), tableTitle (String|null),
///    foodName, quantity (int), note (String|null),
///    cookingStatus ("waiting"|"cooking"), createdAt }`.
///
/// The server already filters to the cook's assigned foods and only returns
/// items still needing cooking. `tableNumber` / `tableTitle` / `note` may be
/// null (takeaway/delivery or no note).
class KitchenItem {
  final String orderId;
  final String itemId;
  final String receiptNumber;
  final String orderType; // "dineIn" | "takeaway" | "delivery"
  final int? tableNumber;
  final String? tableTitle;
  final String foodName;
  final int quantity;
  final String? note;
  final String cookingStatus; // "waiting" | "cooking"
  final DateTime? createdAt;

  const KitchenItem({
    required this.orderId,
    required this.itemId,
    required this.receiptNumber,
    required this.orderType,
    this.tableNumber,
    this.tableTitle,
    required this.foodName,
    required this.quantity,
    this.note,
    required this.cookingStatus,
    this.createdAt,
  });

  bool get isDineIn => orderType == 'dineIn';
  bool get isWaiting => cookingStatus == 'waiting';
  bool get isCooking => cookingStatus == 'cooking';
  bool get isReady => cookingStatus == 'ready';

  factory KitchenItem.fromJson(Map<String, dynamic> json) {
    return KitchenItem(
      orderId: (json['orderId'] ?? '').toString(),
      itemId: (json['itemId'] ?? '').toString(),
      receiptNumber: (json['receiptNumber'] ?? '').toString(),
      orderType: (json['orderType'] ?? 'dineIn').toString(),
      tableNumber: _toIntOrNull(json['tableNumber']),
      tableTitle: _toStringOrNull(json['tableTitle']),
      foodName: (json['foodName'] ?? '').toString(),
      quantity: _toInt(json['quantity']),
      note: _toStringOrNull(json['note']),
      cookingStatus: (json['cookingStatus'] ?? 'waiting').toString(),
      createdAt: _toDate(json['createdAt']),
    );
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

  static String? _toStringOrNull(dynamic value) {
    if (value == null) return null;
    final s = value.toString().trim();
    return s.isEmpty ? null : s;
  }

  static DateTime? _toDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
