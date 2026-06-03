/// A single line of an order. Backend shape:
/// `{ _id, foodName, foodPrice, quantity }`.
class OrderItem {
  final String foodName;
  final num foodPrice;
  final int quantity;

  const OrderItem({
    required this.foodName,
    required this.foodPrice,
    required this.quantity,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      foodName: (json['foodName'] ?? '').toString(),
      foodPrice: _toNum(json['foodPrice']),
      quantity: _toInt(json['quantity']),
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
}

/// A waiter-facing order.
///
/// Backend shape:
/// `{ _id, receiptNumber, orderType ("dineIn"|"takeaway"|"delivery"),
///    table: {_id,number,title} OR null, waiter: {waiterId, name},
///    foods: [...], subTotal, totalPrice,
///    paymentStatus ("pending"|"paid"|"partiallyPaid"|"refunded"),
///    isCancel, createdAt }`.
///
/// `table` may be null (takeaway/delivery) — [tableNumber]/[tableTitle] stay
/// null in that case.
class OrderModel {
  final String id;
  final String receiptNumber;
  final String orderType; // "dineIn" | "takeaway" | "delivery"
  final int? tableNumber;
  final String? tableTitle;
  final String? waiterId;
  final String? waiterName;
  final List<OrderItem> items;
  final num subTotal;
  final num totalPrice;
  final String paymentStatus; // "pending"|"paid"|"partiallyPaid"|"refunded"
  final bool isCancel;
  final DateTime? createdAt;

  const OrderModel({
    required this.id,
    required this.receiptNumber,
    required this.orderType,
    this.tableNumber,
    this.tableTitle,
    this.waiterId,
    this.waiterName,
    this.items = const [],
    this.subTotal = 0,
    this.totalPrice = 0,
    this.paymentStatus = 'pending',
    this.isCancel = false,
    this.createdAt,
  });

  bool get isDineIn => orderType == 'dineIn';
  bool get isPaid => paymentStatus == 'paid';

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final table = _TableRef.parse(json['table']);
    final waiter = _WaiterRef.parse(json['waiter']);

    final foodsRaw = json['foods'];
    final items = <OrderItem>[];
    if (foodsRaw is List) {
      for (final f in foodsRaw) {
        if (f is Map) {
          items.add(OrderItem.fromJson(f.cast<String, dynamic>()));
        }
      }
    }

    return OrderModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      receiptNumber: (json['receiptNumber'] ?? '').toString(),
      orderType: (json['orderType'] ?? 'dineIn').toString(),
      tableNumber: table.number,
      tableTitle: table.title,
      waiterId: waiter.id,
      waiterName: waiter.name,
      items: items,
      subTotal: _toNum(json['subTotal']),
      totalPrice: _toNum(json['totalPrice']),
      paymentStatus: (json['paymentStatus'] ?? 'pending').toString(),
      isCancel: json['isCancel'] == true,
      createdAt: _toDate(json['createdAt']),
    );
  }

  static num _toNum(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static DateTime? _toDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}

/// Reads `table` that may be null or a populated `{_id,number,title}` map.
class _TableRef {
  final int? number;
  final String? title;

  const _TableRef(this.number, this.title);

  static _TableRef parse(dynamic value) {
    if (value is Map) {
      final n = value['number'];
      int? number;
      if (n is int) {
        number = n;
      } else if (n is num) {
        number = n.toInt();
      } else if (n != null) {
        number = int.tryParse(n.toString());
      }
      final title = value['title'];
      return _TableRef(number, title?.toString());
    }
    return const _TableRef(null, null);
  }
}

/// Reads `waiter` shaped as `{ waiterId, name }`.
class _WaiterRef {
  final String? id;
  final String? name;

  const _WaiterRef(this.id, this.name);

  static _WaiterRef parse(dynamic value) {
    if (value is Map) {
      final id = value['waiterId'] ?? value['_id'] ?? value['id'];
      final name = value['name'];
      return _WaiterRef(id?.toString(), name?.toString());
    }
    if (value is String && value.isNotEmpty) {
      return _WaiterRef(value, null);
    }
    return const _WaiterRef(null, null);
  }
}
