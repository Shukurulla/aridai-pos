import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/category.dart';
import '../../models/food.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Reusable categorized menu — a search field over a category accordion
/// (one folder open at a time), matching the reference waiter app. Each screen
/// supplies how a single food row looks via [rowBuilder] (a read-only row for
/// the browser, a stepper row for the order flow), so the layout + search +
/// expand logic live here once.
class MenuAccordion extends StatefulWidget {
  const MenuAccordion({
    super.key,
    required this.categories,
    required this.foods,
    required this.onRefresh,
    required this.rowBuilder,
    this.listPadding = const EdgeInsets.fromLTRB(20, 12, 20, 28),
  });

  final List<Category> categories;
  final List<Food> foods;
  final Future<void> Function() onRefresh;
  final Widget Function(Food food) rowBuilder;
  final EdgeInsetsGeometry listPadding;

  @override
  State<MenuAccordion> createState() => _MenuAccordionState();
}

class _MenuAccordionState extends State<MenuAccordion> {
  static const String _orphanId = '__orphan__';

  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  String? _expandedId;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      final q = _searchController.text.trim().toLowerCase();
      if (q == _query) return;
      setState(() => _query = q);
    });
  }

  bool _match(Food f) => _query.isEmpty || f.name.toLowerCase().contains(_query);

  List<Food> _foodsOf(String categoryId) => widget.foods
      .where((f) => f.categoryId == categoryId && _match(f))
      .toList(growable: false);

  /// Foods whose category isn't among [widget.categories] (orphans).
  List<Food> get _orphanFoods {
    final ids = widget.categories.map((c) => c.id).toSet();
    return widget.foods
        .where((f) =>
            (f.categoryId == null || !ids.contains(f.categoryId)) && _match(f))
        .toList(growable: false);
  }

  List<Food> get _allMatching =>
      widget.foods.where(_match).toList(growable: false);

  void _toggle(String id) {
    setState(() => _expandedId = _expandedId == id ? null : id);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _searchBar(),
        Expanded(child: _query.isNotEmpty ? _flatResults() : _accordion()),
      ],
    );
  }

  // ─── Search bar ────────────────────────────────────────────────────
  Widget _searchBar() {
    return Container(
      color: AppColors.bg,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Container(
        height: 42,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line2),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            const Icon(Icons.search, color: AppColors.mute, size: 16),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _searchController,
                style: sansStyle(size: 13, color: AppColors.ink),
                cursorColor: AppColors.ink,
                decoration: InputDecoration(
                  isCollapsed: true,
                  hintText: 'Поиск по меню…',
                  hintStyle: sansStyle(size: 13, color: AppColors.mute),
                  border: InputBorder.none,
                ),
              ),
            ),
            if (_query.isNotEmpty)
              GestureDetector(
                onTap: () => _searchController.clear(),
                behavior: HitTestBehavior.opaque,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close, color: AppColors.mute, size: 14),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ─── Accordion (no search) ─────────────────────────────────────────
  Widget _accordion() {
    final orphans = _orphanFoods;
    final hasAny = widget.categories.isNotEmpty || orphans.isNotEmpty;
    if (!hasAny) {
      return _refreshable(
        const WaiterEmpty(
          icon: Icons.restaurant_menu,
          title: 'Меню пусто',
          sub: 'Блюда появятся здесь',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: widget.listPadding,
        children: [
          for (final c in widget.categories)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _categorySection(c.id, c.title, _foodsOf(c.id)),
            ),
          if (orphans.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _categorySection(_orphanId, 'Без категории', orphans),
            ),
        ],
      ),
    );
  }

  Widget _categorySection(String id, String title, List<Food> foods) {
    final expanded = _expandedId == id;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: () => _toggle(id),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: expanded ? AppColors.ink : AppColors.surface2,
                      border: Border.all(
                        color: expanded ? AppColors.ink : AppColors.line,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      expanded ? Icons.folder_open : Icons.folder_outlined,
                      color: expanded ? Colors.white : AppColors.mute,
                      size: 18,
                    ),
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
                          style: sansStyle(
                            size: 14,
                            weight: FontWeight.w500,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${foods.length} блюд',
                          style: sansStyle(size: 11, color: AppColors.mute),
                        ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(
                      Icons.keyboard_arrow_down,
                      color: AppColors.mute,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (expanded)
            Container(
              decoration: const BoxDecoration(
                color: AppColors.bg,
                border: Border(top: BorderSide(color: AppColors.line)),
              ),
              padding: const EdgeInsets.all(12),
              child: foods.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'В этой категории нет блюд',
                        textAlign: TextAlign.center,
                        style: sansStyle(size: 12, color: AppColors.mute),
                      ),
                    )
                  : Column(
                      children: [
                        for (int i = 0; i < foods.length; i++)
                          Padding(
                            padding: EdgeInsets.only(
                              bottom: i == foods.length - 1 ? 0 : 8,
                            ),
                            child: widget.rowBuilder(foods[i]),
                          ),
                      ],
                    ),
            ),
        ],
      ),
    );
  }

  // ─── Flat search results ───────────────────────────────────────────
  Widget _flatResults() {
    final results = _allMatching;
    if (results.isEmpty) {
      return _refreshable(
        WaiterEmpty(
          icon: Icons.search,
          title: 'Ничего не найдено',
          sub: 'Нет результатов по «${_searchController.text.trim()}»',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: widget.listPadding,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              'Результатов: ${results.length}',
              style: sansStyle(size: 12, color: AppColors.mute),
            ),
          ),
          for (final f in results)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: widget.rowBuilder(f),
            ),
        ],
      ),
    );
  }

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.5,
            child: child,
          ),
        ],
      ),
    );
  }
}
