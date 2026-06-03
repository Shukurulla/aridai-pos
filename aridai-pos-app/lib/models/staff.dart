/// A branch staff member as returned by `GET /users/all/<branchId>`.
///
/// Backend shape:
/// `{ _id, name, phone, role, isActive, image,
///    salary: { mode, amount },
///    assignedCategories: [id], assignedFoods: [id] }`.
///
/// [salaryMode] is one of `none` / `daily` / `monthly` / `percent`. For
/// `percent`, [salaryAmount] is the percentage; otherwise a money figure.
class StaffMember {
  final String id;
  final String name;
  final String phone;
  final String role; // waiter | cook | cashier | branch_admin | owner | ...
  final bool isActive;
  final String? image;
  final String salaryMode; // none | daily | monthly | percent
  final num salaryAmount;
  final List<String> assignedCategories;
  final List<String> assignedFoods;

  const StaffMember({
    required this.id,
    required this.name,
    required this.phone,
    required this.role,
    this.isActive = true,
    this.image,
    this.salaryMode = 'none',
    this.salaryAmount = 0,
    this.assignedCategories = const [],
    this.assignedFoods = const [],
  });

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    final salary = json['salary'];
    String mode = 'none';
    num amount = 0;
    if (salary is Map) {
      mode = (salary['mode'] ?? 'none').toString();
      amount = _toNum(salary['amount']);
    }

    return StaffMember(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      isActive: json['isActive'] != false, // default active
      image: json['image']?.toString(),
      salaryMode: mode,
      salaryAmount: amount,
      assignedCategories: _toIdList(json['assignedCategories']),
      assignedFoods: _toIdList(json['assignedFoods']),
    );
  }

  static num _toNum(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  /// Normalise a list that may contain id strings or populated `{_id}` maps.
  static List<String> _toIdList(dynamic value) {
    if (value is! List) return const [];
    final out = <String>[];
    for (final e in value) {
      if (e is Map) {
        final id = e['_id'] ?? e['id'];
        if (id != null) out.add(id.toString());
      } else if (e != null) {
        out.add(e.toString());
      }
    }
    return out;
  }
}
