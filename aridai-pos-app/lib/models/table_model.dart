/// A dine-in table or cabin in a branch.
///
/// Backend shape: `{ _id, number, title, type ("table"|"cabin"), isActive }`.
class TableModel {
  final String id;
  final int number;
  final String title;
  final String type; // "table" | "cabin"
  final bool isActive;

  const TableModel({
    required this.id,
    required this.number,
    required this.title,
    required this.type,
    required this.isActive,
  });

  bool get isCabin => type == 'cabin';

  factory TableModel.fromJson(Map<String, dynamic> json) {
    return TableModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      number: _toInt(json['number']),
      title: (json['title'] ?? '').toString(),
      type: (json['type'] ?? 'table').toString(),
      isActive: json['isActive'] == true,
    );
  }

  static int _toInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}
