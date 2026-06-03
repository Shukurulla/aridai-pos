/// Logged-in user. UI varies by [role] (waiter / cook / cashier /
/// branch_admin / owner / system_admin).
class User {
  final String id;
  final String name;
  final String phone;
  final String role;
  final String? branchId;
  final String? restaurantId;
  final String? branchName;
  final String? restaurantName;
  final String? image;
  final SalaryInfo? salary;

  const User({
    required this.id,
    required this.name,
    required this.phone,
    required this.role,
    this.branchId,
    this.restaurantId,
    this.branchName,
    this.restaurantName,
    this.image,
    this.salary,
  });

  /// Backend may send `branch` / `restaurantId` either as a plain id string
  /// or as a populated object `{ "_id": "...", "name": "..." }`. We normalise
  /// both shapes: store the id string, and capture the name when present.
  factory User.fromJson(Map<String, dynamic> json) {
    final branchRef = _RefData.parse(json['branch']);
    final restaurantRef = _RefData.parse(json['restaurantId']);

    return User(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      branchId: branchRef.id,
      branchName: branchRef.name,
      restaurantId: restaurantRef.id,
      restaurantName: restaurantRef.name,
      image: json['image']?.toString(),
      salary: SalaryInfo.parse(json['salary']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'phone': phone,
      'role': role,
      'branch': branchId,
      'branchName': branchName,
      'restaurantId': restaurantId,
      'restaurantName': restaurantName,
      'image': image,
      if (salary != null) 'salary': salary!.toJson(),
    };
  }
}

/// A staff member's salary configuration.
///
/// Backend shape: `salary: { mode, amount }`, where `mode` is one of
/// `none` / `daily` / `monthly` / `percent`. For `percent`, [amount] is the
/// percentage; otherwise it is a money figure.
class SalaryInfo {
  final String mode; // none | daily | monthly | percent
  final num amount;

  const SalaryInfo({required this.mode, required this.amount});

  /// Parse from a json `salary` value; returns null when absent/invalid.
  static SalaryInfo? parse(dynamic value) {
    if (value is! Map) return null;
    final mode = (value['mode'] ?? 'none').toString();
    final rawAmount = value['amount'];
    final num amount = rawAmount is num
        ? rawAmount
        : num.tryParse(rawAmount?.toString() ?? '') ?? 0;
    return SalaryInfo(mode: mode, amount: amount);
  }

  Map<String, dynamic> toJson() => {'mode': mode, 'amount': amount};
}

/// Helper to read a reference field that can be a String id or a Map.
class _RefData {
  final String? id;
  final String? name;

  const _RefData(this.id, this.name);

  static _RefData parse(dynamic value) {
    if (value == null) return const _RefData(null, null);
    if (value is String) {
      return _RefData(value.isEmpty ? null : value, null);
    }
    if (value is Map) {
      final id = value['_id'] ?? value['id'];
      final name = value['name'];
      return _RefData(
        id?.toString(),
        name?.toString(),
      );
    }
    return const _RefData(null, null);
  }
}
