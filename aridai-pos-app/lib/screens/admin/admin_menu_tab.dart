import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/category.dart';
import '../../models/food.dart';
import '../../models/table_model.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';
import 'admin_food_form.dart';

/// Table/cabin type presets (mirrors the backend `table.type` field).
const _tableTypes = <({String key, String label})>[
  (key: 'normal', label: 'Стол'),
  (key: 'cabin', label: 'Кабина'),
  (key: 'vip', label: 'VIP'),
  (key: 'billiard', label: 'Бильярд'),
];

String _tableTypeLabel(String key) {
  for (final t in _tableTypes) {
    if (t.key == key) return t.label;
  }
  return 'Стол';
}

/// Branch-admin "Меню" tab — three managed sections behind a segmented
/// control: Блюда (menu items, with image), Категории and Столы. Each section
/// supports create / edit / delete against the global backend.
class AdminMenuTab extends StatefulWidget {
  const AdminMenuTab({super.key});

  @override
  State<AdminMenuTab> createState() => _AdminMenuTabState();
}

class _AdminMenuTabState extends State<AdminMenuTab> {
  final ApiService _api = ApiService.instance;

  int _section = 0; // 0 = foods, 1 = categories, 2 = tables
  bool _isLoading = true;
  String? _error;
  List<Food> _foods = const [];
  List<Category> _categories = const [];
  List<TableModel> _tables = const [];

  /// Ids whose write (delete) call is in-flight.
  final Set<String> _busy = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getFoods(),
        _api.getCategories(),
        _api.getTables(),
      ]);
      if (!mounted) return;
      setState(() {
        _foods = results[0] as List<Food>;
        _categories = results[1] as List<Category>;
        _tables = results[2] as List<TableModel>;
        _isLoading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  // ─── Grouping helpers ──────────────────────────────────────────────

  /// Foods grouped under their category (in category order); a trailing
  /// "Без категории" group collects orphans.
  List<({Category? cat, List<Food> foods})> get _foodGroups {
    final byCat = <String, List<Food>>{};
    for (final f in _foods) {
      byCat.putIfAbsent(f.categoryId ?? '', () => []).add(f);
    }
    final groups = <({Category? cat, List<Food> foods})>[];
    for (final c in _categories) {
      final fs = byCat.remove(c.id);
      if (fs != null && fs.isNotEmpty) groups.add((cat: c, foods: fs));
    }
    final leftover = <Food>[];
    byCat.forEach((_, v) => leftover.addAll(v));
    if (leftover.isNotEmpty) groups.add((cat: null, foods: leftover));
    return groups;
  }

  int _foodCount(String categoryId) =>
      _foods.where((f) => f.categoryId == categoryId).length;

  // ─── Actions ───────────────────────────────────────────────────────

  void _onAdd() {
    switch (_section) {
      case 0:
        _openFoodForm();
      case 1:
        _categoryDialog();
      case 2:
        _tableDialog();
    }
  }

  Future<void> _openFoodForm({Food? editing}) async {
    if (_categories.isEmpty) {
      showAdminSnack(context, 'Сначала создайте категорию');
      setState(() => _section = 1);
      return;
    }
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            AdminFoodForm(categories: _categories, editing: editing),
      ),
    );
    if (changed == true) _load(silent: true);
  }

  Future<void> _runBusy(
    String id,
    Future<void> Function() action,
    String okMsg,
  ) async {
    if (_busy.contains(id)) return;
    setState(() => _busy.add(id));
    try {
      await action();
      await _load(silent: true);
      if (mounted) showAdminSnack(context, okMsg);
    } catch (e) {
      if (mounted) {
        showAdminSnack(context, e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  Future<bool> _confirmDelete(String title, String message) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title, style: sansStyle(size: 16, weight: FontWeight.w600)),
        content: Text(message, style: sansStyle(size: 13, color: AppColors.mute)),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Отмена', style: sansStyle(size: 14, color: AppColors.mute)),
          ),
          AdminButton(
            label: 'Удалить',
            color: AppColors.red,
            onTap: () => Navigator.of(ctx).pop(true),
          ),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _deleteFood(Food f) async {
    if (!await _confirmDelete(
        'Удалить блюдо?', '«${f.name}» будет удалено без возможности восстановления.')) {
      return;
    }
    await _runBusy(f.id, () => _api.deleteFood(f.id), 'Блюдо удалено');
  }

  Future<void> _deleteCategory(Category c) async {
    final n = _foodCount(c.id);
    final extra = n > 0 ? ' В ней $n блюд — они потеряют категорию.' : '';
    if (!await _confirmDelete('Удалить категорию?', '«${c.title}» будет удалена.$extra')) {
      return;
    }
    await _runBusy(c.id, () => _api.deleteCategory(c.id), 'Категория удалена');
  }

  Future<void> _deleteTable(TableModel t) async {
    if (!await _confirmDelete(
        'Удалить стол?', '«${t.title}» (№${t.number}) будет удалён.')) {
      return;
    }
    await _runBusy(t.id, () => _api.deleteTable(t.id), 'Стол удалён');
  }

  Future<void> _categoryDialog({Category? editing}) async {
    final controller = TextEditingController(text: editing?.title ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          editing == null ? 'Новая категория' : 'Переименовать категорию',
          style: sansStyle(size: 16, weight: FontWeight.w600),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
          style: sansStyle(size: 15, color: AppColors.ink),
          decoration: _dialogInput('Название категории'),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('Отмена', style: sansStyle(size: 14, color: AppColors.mute)),
          ),
          AdminButton(
            label: 'Сохранить',
            onTap: () => Navigator.of(ctx).pop(controller.text.trim()),
          ),
        ],
      ),
    );
    if (result == null || result.isEmpty) return;
    final id = editing?.id ?? 'new-category';
    await _runBusy(
      id,
      () => editing == null
          ? _api.createCategory(result).then((_) {})
          : _api.updateCategory(editing.id, result).then((_) {}),
      editing == null ? 'Категория создана' : 'Сохранено',
    );
  }

  Future<void> _tableDialog({TableModel? editing}) async {
    final numberController =
        TextEditingController(text: editing != null ? '${editing.number}' : '');
    final titleController = TextEditingController(text: editing?.title ?? '');
    String type = editing?.type ?? 'normal';
    if (!_tableTypes.any((t) => t.key == type)) type = 'normal';

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            editing == null ? 'Новый стол' : 'Редактировать стол',
            style: sansStyle(size: 16, weight: FontWeight.w600),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: numberController,
                autofocus: editing == null,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: sansStyle(size: 15, color: AppColors.ink),
                decoration: _dialogInput('Номер'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleController,
                textCapitalization: TextCapitalization.sentences,
                style: sansStyle(size: 15, color: AppColors.ink),
                decoration: _dialogInput('Название (необязательно)'),
              ),
              const SizedBox(height: 14),
              Text('Тип',
                  style: sansStyle(
                      size: 12, weight: FontWeight.w600, color: AppColors.mute)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final t in _tableTypes)
                    GestureDetector(
                      onTap: () => setDialog(() => type = t.key),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 13, vertical: 8),
                        decoration: BoxDecoration(
                          color:
                              type == t.key ? AppColors.ink : AppColors.surface2,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: type == t.key
                                  ? AppColors.ink
                                  : AppColors.line),
                        ),
                        child: Text(
                          t.label,
                          style: sansStyle(
                            size: 13,
                            weight: FontWeight.w500,
                            color:
                                type == t.key ? Colors.white : AppColors.ink2,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child:
                  Text('Отмена', style: sansStyle(size: 14, color: AppColors.mute)),
            ),
            AdminButton(
              label: 'Сохранить',
              onTap: () {
                final number = int.tryParse(numberController.text.trim());
                if (number == null) return;
                Navigator.of(ctx).pop({
                  'number': number,
                  'title': titleController.text.trim().isEmpty
                      ? 'Стол $number'
                      : titleController.text.trim(),
                  'type': type,
                });
              },
            ),
          ],
        ),
      ),
    );
    if (result == null) return;
    final id = editing?.id ?? 'new-table';
    final number = result['number'] as int;
    final title = result['title'] as String;
    final t = result['type'] as String;
    await _runBusy(
      id,
      () => editing == null
          ? _api
              .createTable(number: number, title: title, type: t)
              .then((_) {})
          : _api
              .updateTable(editing.id, number: number, title: title, type: t)
              .then((_) {}),
      editing == null ? 'Стол создан' : 'Сохранено',
    );
  }

  InputDecoration _dialogInput(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: sansStyle(size: 15, color: AppColors.mute2),
        filled: true,
        fillColor: AppColors.surface2,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.red),
        ),
      );

  // ─── Build ─────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final subtitle = _isLoading
        ? 'Загрузка…'
        : switch (_section) {
            1 => '${_categories.length} категорий',
            2 => '${_tables.length} столов',
            _ => '${_foods.length} блюд · ${_categories.length} категорий',
          };
    return Scaffold(
      backgroundColor: AppColors.bg,
      floatingActionButton: (_isLoading || _error != null)
          ? null
          : FloatingActionButton(
              onPressed: _onAdd,
              backgroundColor: AppColors.red,
              foregroundColor: Colors.white,
              elevation: 2,
              child: const Icon(Icons.add_rounded, size: 26),
            ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AdminHeader(
              title: 'Меню',
              subtitle: subtitle,
              trailing: AdminRefreshButton(onTap: _isLoading ? null : _load),
            ),
            _segmentBar(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _segmentBar() {
    return Container(
      color: AppColors.bg,
      padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
      child: Row(
        children: [
          _seg(0, 'Блюда', _foods.length),
          const SizedBox(width: 8),
          _seg(1, 'Категории', _categories.length),
          const SizedBox(width: 8),
          _seg(2, 'Столы', _tables.length),
        ],
      ),
    );
  }

  Widget _seg(int i, String label, int count) {
    return WaiterChip(
      label: label,
      active: _section == i,
      count: count,
      onTap: () => setState(() => _section = i),
    );
  }

  Widget _body() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.red));
    }
    if (_error != null) {
      return _refreshable(
        WaiterEmpty(
          icon: Icons.error_outline,
          title: 'Не удалось загрузить',
          sub: _error,
        ),
      );
    }
    return switch (_section) {
      1 => _categoriesBody(),
      2 => _tablesBody(),
      _ => _foodsBody(),
    };
  }

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.55,
            child: child,
          ),
        ],
      ),
    );
  }

  // ─── Foods ─────────────────────────────────────────────────────────

  Widget _foodsBody() {
    if (_foods.isEmpty) {
      return _refreshable(
        WaiterEmpty(
          icon: Icons.restaurant_menu_outlined,
          title: 'Блюд нет',
          sub: _categories.isEmpty
              ? 'Сначала создайте категорию'
              : 'Нажмите «+», чтобы добавить блюдо',
        ),
      );
    }
    final groups = _foodGroups;
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
        children: [
          for (final g in groups) ...[
            SectionHeader(
              title: g.cat?.title ?? 'Без категории',
              sub: '${g.foods.length} блюд',
            ),
            ...g.foods.map(
              (f) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _foodCard(f),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _foodCard(Food f) {
    final url = ApiService.imageUrl(f.image);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openFoodForm(editing: f),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: url != null
                      ? CachedNetworkImage(
                          imageUrl: url,
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) => _thumbFallback(),
                          placeholder: (_, _) => Container(
                            color: AppColors.surface2,
                          ),
                        )
                      : _thumbFallback(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      f.name.isEmpty ? 'Без названия' : f.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sansStyle(size: 15, weight: FontWeight.w500),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Text(
                          fmtMoney(f.price),
                          style: numStyle(size: 13, color: AppColors.ink2),
                        ),
                        if (f.isHourly) ...[
                          const SizedBox(width: 6),
                          Text('/час',
                              style:
                                  sansStyle(size: 11, color: AppColors.mute)),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              _DeleteButton(
                busy: _busy.contains(f.id),
                onTap: () => _deleteFood(f),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _thumbFallback() {
    return Container(
      color: AppColors.surface2,
      alignment: Alignment.center,
      child: const Icon(Icons.restaurant, size: 20, color: AppColors.mute2),
    );
  }

  // ─── Categories ────────────────────────────────────────────────────

  Widget _categoriesBody() {
    if (_categories.isEmpty) {
      return _refreshable(
        const WaiterEmpty(
          icon: Icons.category_outlined,
          title: 'Категорий нет',
          sub: 'Нажмите «+», чтобы добавить',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
        children: [
          for (final c in _categories)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _simpleCard(
                leadingIcon: Icons.label_outline,
                title: c.title,
                subtitle: '${_foodCount(c.id)} блюд',
                busy: _busy.contains(c.id),
                onTap: () => _categoryDialog(editing: c),
                onDelete: () => _deleteCategory(c),
              ),
            ),
        ],
      ),
    );
  }

  // ─── Tables ────────────────────────────────────────────────────────

  Widget _tablesBody() {
    if (_tables.isEmpty) {
      return _refreshable(
        const WaiterEmpty(
          icon: Icons.table_restaurant_outlined,
          title: 'Столов нет',
          sub: 'Нажмите «+», чтобы добавить',
        ),
      );
    }
    final sorted = [..._tables]..sort((a, b) => a.number.compareTo(b.number));
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 96),
        children: [
          for (final t in sorted)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _tableCard(t),
            ),
        ],
      ),
    );
  }

  Widget _tableCard(TableModel t) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _tableDialog(editing: t),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.ink,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${t.number}',
                  style: numStyle(
                      size: 18, color: Colors.white, weight: FontWeight.w500),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t.title.isEmpty ? 'Стол ${t.number}' : t.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sansStyle(size: 15, weight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        _tableTypeLabel(t.type),
                        style: sansStyle(
                            size: 10,
                            weight: FontWeight.w500,
                            color: AppColors.mute),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              _DeleteButton(
                busy: _busy.contains(t.id),
                onTap: () => _deleteTable(t),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Shared simple card (categories) ───────────────────────────────

  Widget _simpleCard({
    required IconData leadingIcon,
    required String title,
    required String subtitle,
    required bool busy,
    required VoidCallback onTap,
    required VoidCallback onDelete,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(leadingIcon, size: 20, color: AppColors.ink2),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title.isEmpty ? 'Без названия' : title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: sansStyle(size: 15, weight: FontWeight.w500),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: sansStyle(size: 12, color: AppColors.mute)),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              _DeleteButton(busy: busy, onTap: onDelete),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small circular delete button with an in-flight spinner (matches the staff
/// tab's row action).
class _DeleteButton extends StatelessWidget {
  final bool busy;
  final VoidCallback onTap;
  const _DeleteButton({required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: busy ? null : onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 36,
          height: 36,
          child: busy
              ? const Center(
                  child: SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.mute),
                    ),
                  ),
                )
              : const Icon(Icons.delete_outline, size: 19, color: AppColors.mute),
        ),
      ),
    );
  }
}
