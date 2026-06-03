/// A menu category. Backend shape: `{ _id, title }`.
class Category {
  final String id;
  final String title;

  const Category({required this.id, required this.title});

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
    );
  }
}
