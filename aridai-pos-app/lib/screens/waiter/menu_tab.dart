import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/category.dart';
import '../../models/food.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'menu_accordion.dart';

/// Read-only menu browser: horizontal category chips + a list of foods for
/// the selected category. `_all` is a synthetic "Все" category.
class MenuTab extends StatefulWidget {
  const MenuTab({super.key});

  @override
  State<MenuTab> createState() => _MenuTabState();
}

class _MenuTabState extends State<MenuTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<Category> _categories = const [];
  List<Food> _foods = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getCategories(),
        _api.getFoods(),
      ]);
      if (!mounted) return;
      setState(() {
        _categories = results[0] as List<Category>;
        _foods = results[1] as List<Food>;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Меню',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _isLoading ? 'Загрузка…' : '${_foods.length} блюд',
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          Material(
            color: AppColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.line2),
            ),
            child: InkWell(
              onTap: _isLoading ? null : _load,
              borderRadius: BorderRadius.circular(12),
              child: const SizedBox(
                width: 36,
                height: 36,
                child: Icon(Icons.refresh, size: 18, color: AppColors.ink),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.red),
      );
    }
    if (_error != null) {
      return RefreshIndicator(
        onRefresh: _load,
        color: AppColors.red,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: WaiterEmpty(
                icon: Icons.error_outline,
                title: 'Не удалось загрузить',
                sub: _error,
              ),
            ),
          ],
        ),
      );
    }
    return MenuAccordion(
      categories: _categories,
      foods: _foods,
      onRefresh: _load,
      listPadding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
      rowBuilder: (f) => _FoodRow(food: f),
    );
  }
}

class _FoodRow extends StatelessWidget {
  final Food food;
  const _FoodRow({required this.food});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _Thumb(food: food),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  food.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: AppColors.ink,
                  ),
                ),
                if (food.categoryTitle != null &&
                    food.categoryTitle!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    food.categoryTitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: sansStyle(size: 11, color: AppColors.mute2),
                  ),
                ],
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      fmtNumber(food.price),
                      style: numStyle(
                        size: 14,
                        weight: FontWeight.w500,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      food.isHourly ? '₸/ч' : '₸',
                      style: GoogleFonts.ibmPlexSans(
                        fontSize: 10,
                        color: AppColors.mute,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  final Food food;
  const _Thumb({required this.food});

  @override
  Widget build(BuildContext context) {
    final url = ApiService.imageUrl(food.image);
    final letter = food.name.isNotEmpty ? food.name[0].toUpperCase() : '?';

    Widget placeholder() => Center(
          child: Text(
            letter,
            style: GoogleFonts.ibmPlexSerif(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              fontStyle: FontStyle.italic,
              color: AppColors.mute2,
            ),
          ),
        );

    return Container(
      width: 54,
      height: 54,
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: url == null
          ? placeholder()
          : CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              placeholder: (context, url) => placeholder(),
              errorWidget: (context, url, error) => placeholder(),
            ),
    );
  }
}
