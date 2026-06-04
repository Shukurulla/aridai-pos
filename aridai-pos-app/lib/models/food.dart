/// A menu item.
///
/// Backend shape:
/// `{ _id, name, price, image (may be null), isHourly,
///    category: {_id,title} OR a string id }`.
///
/// `category` is normalised: [categoryId] always holds the id string and
/// [categoryTitle] captures the title when the field was a populated object.
class Food {
  final String id;
  final String name;
  final num price;
  final String? image;
  final bool isHourly;
  final String? categoryId;
  final String? categoryTitle;
  final String? description;

  const Food({
    required this.id,
    required this.name,
    required this.price,
    this.image,
    this.isHourly = false,
    this.categoryId,
    this.categoryTitle,
    this.description,
  });

  factory Food.fromJson(Map<String, dynamic> json) {
    final cat = _CategoryRef.parse(json['category']);
    final rawImage = json['image']?.toString();
    final rawDesc = json['description']?.toString();

    return Food(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      price: _toNum(json['price']),
      image: (rawImage == null || rawImage.isEmpty) ? null : rawImage,
      isHourly: json['isHourly'] == true,
      categoryId: cat.id,
      categoryTitle: cat.title,
      description: (rawDesc == null || rawDesc.isEmpty) ? null : rawDesc,
    );
  }

  static num _toNum(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }
}

/// Reads `category` that may be a String id or a populated `{_id,title}` map.
class _CategoryRef {
  final String? id;
  final String? title;

  const _CategoryRef(this.id, this.title);

  static _CategoryRef parse(dynamic value) {
    if (value == null) return const _CategoryRef(null, null);
    if (value is String) {
      return _CategoryRef(value.isEmpty ? null : value, null);
    }
    if (value is Map) {
      final id = value['_id'] ?? value['id'];
      final title = value['title'];
      return _CategoryRef(id?.toString(), title?.toString());
    }
    return const _CategoryRef(null, null);
  }
}
