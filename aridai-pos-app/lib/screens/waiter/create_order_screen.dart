import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/category.dart';
import '../../models/food.dart';
import '../../models/order.dart';
import '../../models/table_model.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Order creation flow. Pick an order type (Зал / Собой), a table (for Зал),
/// then add foods to a cart and submit via `POST /orders/place`.
///
/// When [table] is supplied the type is forced to Зал and that table is
/// preselected (still changeable). Pops `true` on a successful create so the
/// caller can switch to the orders tab and reload.
class CreateOrderScreen extends StatefulWidget {
  const CreateOrderScreen({super.key, this.table});

  /// Optional preselected dine-in table.
  final TableModel? table;

  @override
  State<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends State<CreateOrderScreen> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  bool _submitting = false;

  List<Category> _categories = const [];
  List<Food> _foods = const [];
  List<TableModel> _tables = const [];
  Set<int> _occupied = const {};

  /// "dineIn" | "takeaway". Always opens on Зал; a preselected [table] keeps
  /// it there with that table chosen.
  String _orderType = 'dineIn';

  /// Selected dine-in table (null = none chosen yet).
  TableModel? _table;

  /// Selected category id; null = "Все".
  String? _categoryId;

  /// foodId -> quantity.
  final Map<String, int> _cart = {};

  /// foodId -> Food (so the cart can render names/prices without a re-lookup).
  final Map<String, Food> _cartFoods = {};

  @override
  void initState() {
    super.initState();
    _table = widget.table;
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getCategories(),
        _api.getFoods(),
        _api.getTables(),
        _api.getOrders(),
      ]);
      final categories = results[0] as List<Category>;
      final foods = results[1] as List<Food>;
      final tables = (results[2] as List<TableModel>)
        ..sort((a, b) => a.number.compareTo(b.number));
      final orders = results[3] as List<OrderModel>;

      final occupied = <int>{};
      for (final o in orders) {
        if (o.isDineIn &&
            !o.isCancel &&
            o.paymentStatus != 'paid' &&
            o.tableNumber != null) {
          occupied.add(o.tableNumber!);
        }
      }

      if (!mounted) return;
      setState(() {
        _categories = categories;
        _foods = foods;
        _tables = tables;
        _occupied = occupied;
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

  List<Food> get _visibleFoods {
    if (_categoryId == null) return _foods;
    return _foods.where((f) => f.categoryId == _categoryId).toList();
  }

  int get _totalItems => _cart.values.fold(0, (s, q) => s + q);

  num get _totalPrice {
    num total = 0;
    _cart.forEach((id, qty) {
      final f = _cartFoods[id];
      if (f != null) total += f.price * qty;
    });
    return total;
  }

  void _add(Food food) {
    setState(() {
      _cart[food.id] = (_cart[food.id] ?? 0) + 1;
      _cartFoods[food.id] = food;
    });
  }

  void _remove(Food food) {
    setState(() {
      final q = _cart[food.id] ?? 0;
      if (q <= 1) {
        _cart.remove(food.id);
        _cartFoods.remove(food.id);
      } else {
        _cart[food.id] = q - 1;
      }
    });
  }

  bool get _canSubmit {
    if (_submitting || _cart.isEmpty) return false;
    if (_orderType == 'dineIn' && _table == null) return false;
    return true;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    try {
      final items = _cart.entries
          .map((e) => <String, dynamic>{'foodId': e.key, 'quantity': e.value})
          .toList();
      await _api.placeOrder(
        tableId: _orderType == 'dineIn' ? _table?.id : null,
        items: items,
        orderType: _orderType,
      );
      if (!mounted) return;
      _snack('Заказ создан', AppColors.ok);
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _snack(e.toString().replaceFirst('Exception: ', ''), AppColors.red);
    }
  }

  void _snack(String text, Color accent) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.ink,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(text, style: sansStyle(size: 13, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _pickTable() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _TablePickerSheet(
        tables: _tables,
        occupied: _occupied,
        selectedId: _table?.id,
        onPick: (t) {
          setState(() => _table = t);
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _topBar(),
            if (!_isLoading && _error == null) _typeAndTable(),
            if (!_isLoading && _error == null && _categories.isNotEmpty)
              _categoryBar(),
            Expanded(child: _body()),
            if (!_isLoading && _error == null) _cartBar(),
          ],
        ),
      ),
    );
  }

  // ─── Top bar ────────────────────────────────────────────────────────────
  Widget _topBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          _IconBtn(
            icon: Icons.chevron_left,
            onTap: () => Navigator.pop(context),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Новый заказ',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  _isLoading ? 'Загрузка…' : '${_foods.length} блюд',
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          if (_cart.isNotEmpty)
            _IconBtn(
              icon: Icons.delete_outline,
              danger: true,
              onTap: () => setState(() {
                _cart.clear();
                _cartFoods.clear();
              }),
            ),
        ],
      ),
    );
  }

  // ─── Type toggle + table chooser ────────────────────────────────────────
  Widget _typeAndTable() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _TypeButton(
                  label: 'Зал',
                  icon: Icons.table_restaurant_outlined,
                  active: _orderType == 'dineIn',
                  onTap: () => setState(() => _orderType = 'dineIn'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TypeButton(
                  label: 'Собой',
                  icon: Icons.shopping_bag_outlined,
                  active: _orderType == 'takeaway',
                  onTap: () => setState(() => _orderType = 'takeaway'),
                ),
              ),
            ],
          ),
          if (_orderType == 'dineIn') ...[
            const SizedBox(height: 10),
            _tableRow(),
          ],
        ],
      ),
    );
  }

  Widget _tableRow() {
    final t = _table;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: _pickTable,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: t == null ? AppColors.line2 : AppColors.ink,
            ),
          ),
          child: Row(
            children: [
              Icon(
                Icons.table_restaurant_outlined,
                size: 18,
                color: t == null ? AppColors.mute : AppColors.ink,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  t == null
                      ? 'Выберите стол'
                      : (t.title.isNotEmpty
                          ? t.title
                          : (t.isCabin
                              ? 'Кабина ${t.number}'
                              : 'Стол ${t.number}')),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: t == null ? AppColors.mute : AppColors.ink,
                  ),
                ),
              ),
              Text(
                t == null ? 'Выбрать' : 'Изменить',
                style: sansStyle(size: 12, color: AppColors.red),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, size: 18, color: AppColors.mute),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Category chips ─────────────────────────────────────────────────────
  Widget _categoryBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: SizedBox(
        height: 32,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            WaiterChip(
              label: 'Все',
              active: _categoryId == null,
              onTap: () => setState(() => _categoryId = null),
            ),
            ..._categories.map(
              (c) => Padding(
                padding: const EdgeInsets.only(left: 8),
                child: WaiterChip(
                  label: c.title,
                  active: _categoryId == c.id,
                  onTap: () => setState(() => _categoryId = c.id),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Body (foods list) ──────────────────────────────────────────────────
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
              height: MediaQuery.of(context).size.height * 0.5,
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

    final foods = _visibleFoods;
    if (foods.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        color: AppColors.red,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.5,
              child: const WaiterEmpty(
                icon: Icons.restaurant_menu,
                title: 'Блюд нет',
                sub: 'В этой категории пока пусто',
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
        itemCount: foods.length,
        itemBuilder: (context, i) {
          final food = foods[i];
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _FoodRow(
              food: food,
              quantity: _cart[food.id] ?? 0,
              onAdd: () => _add(food),
              onRemove: () => _remove(food),
            ),
          );
        },
      ),
    );
  }

  // ─── Bottom cart bar ────────────────────────────────────────────────────
  Widget _cartBar() {
    final empty = _cart.isEmpty;
    final needsTable = _orderType == 'dineIn' && _table == null;
    final enabled = _canSubmit;

    final String hint;
    if (empty) {
      hint = 'Корзина пуста';
    } else if (needsTable) {
      hint = 'Выберите стол';
    } else {
      hint = 'Оформить';
    }

    return Container(
      color: AppColors.bg,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: SafeArea(
        top: false,
        child: DecoratedBox(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Opacity(
              opacity: enabled ? 1 : 0.55,
              child: Material(
                color: AppColors.ink,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: enabled ? _submit : null,
                  child: Container(
                    height: 52,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: AppColors.red,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$_totalItems',
                            style: numStyle(
                              size: 13,
                              weight: FontWeight.w500,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'В ЗАКАЗЕ',
                              style: GoogleFonts.ibmPlexSans(
                                color: Colors.white.withValues(alpha: 0.55),
                                fontSize: 10,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              fmtMoney(_totalPrice),
                              style: numStyle(
                                size: 14,
                                weight: FontWeight.w500,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        if (_submitting)
                          const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        else ...[
                          Text(
                            hint.toUpperCase(),
                            style: GoogleFonts.ibmPlexSans(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 0.6,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Icon(Icons.arrow_forward,
                              size: 14, color: Colors.white),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Order-type segment button ────────────────────────────────────────────
class _TypeButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;
  const _TypeButton({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.ink : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? AppColors.ink : AppColors.line2),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 16, color: active ? Colors.white : AppColors.ink),
              const SizedBox(width: 8),
              Text(
                label,
                style: sansStyle(
                  size: 13,
                  weight: FontWeight.w500,
                  color: active ? Colors.white : AppColors.ink,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Food row with a tap-to-add stepper ────────────────────────────────────
class _FoodRow extends StatelessWidget {
  final Food food;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  const _FoodRow({
    required this.food,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final inCart = quantity > 0;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onAdd,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: inCart ? AppColors.ink : AppColors.line),
          ),
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
              const SizedBox(width: 10),
              if (inCart)
                _Stepper(quantity: quantity, onAdd: onAdd, onRemove: onRemove)
              else
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.ink),
                  ),
                  child: const Icon(Icons.add, size: 16, color: AppColors.ink),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Dark qty stepper ───────────────────────────────────────────────────────
class _Stepper extends StatelessWidget {
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  const _Stepper({
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(10),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: onRemove,
            child: const SizedBox(
              width: 32,
              height: 36,
              child: Icon(Icons.remove, size: 16, color: Colors.white),
            ),
          ),
          Container(
            constraints: const BoxConstraints(minWidth: 24),
            alignment: Alignment.center,
            child: Text(
              '$quantity',
              style: numStyle(
                size: 14,
                weight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
          ),
          InkWell(
            onTap: onAdd,
            child: Container(
              width: 32,
              height: 36,
              color: AppColors.red,
              child: const Icon(Icons.add, size: 16, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Food thumbnail (mirrors menu_tab) ──────────────────────────────────────
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

// ─── Top-bar icon button ────────────────────────────────────────────────────
class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool danger;
  const _IconBtn({
    required this.icon,
    required this.onTap,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: danger ? AppColors.redSoft : AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: danger ? Colors.transparent : AppColors.line2,
            ),
          ),
          child: Icon(
            icon,
            size: danger ? 18 : 20,
            color: danger ? AppColors.red : AppColors.ink,
          ),
        ),
      ),
    );
  }
}

// ─── Table picker bottom sheet ──────────────────────────────────────────────
class _TablePickerSheet extends StatelessWidget {
  final List<TableModel> tables;
  final Set<int> occupied;
  final String? selectedId;
  final ValueChanged<TableModel> onPick;
  const _TablePickerSheet({
    required this.tables,
    required this.occupied,
    required this.selectedId,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.78,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 8, bottom: 12),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.line2,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.line)),
            ),
            child: Row(
              children: [
                const Diamond(size: 5, color: AppColors.red),
                const SizedBox(width: 6),
                Text(
                  'ВЫБЕРИТЕ СТОЛ',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.mute,
                    letterSpacing: 1.8,
                  ),
                ),
              ],
            ),
          ),
          Flexible(
            child: tables.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(32),
                    child: WaiterEmpty(
                      icon: Icons.table_restaurant_outlined,
                      title: 'Столов нет',
                    ),
                  )
                : GridView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 1,
                    ),
                    itemCount: tables.length,
                    itemBuilder: (context, i) {
                      final t = tables[i];
                      final isOcc = occupied.contains(t.number);
                      final isSel = t.id == selectedId;
                      return _TableTile(
                        table: t,
                        occupied: isOcc,
                        selected: isSel,
                        onTap: isOcc ? null : () => onPick(t),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _TableTile extends StatelessWidget {
  final TableModel table;
  final bool occupied;
  final bool selected;
  final VoidCallback? onTap;
  const _TableTile({
    required this.table,
    required this.occupied,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    final Color bd;
    if (occupied) {
      bg = AppColors.surface2;
      fg = AppColors.mute2;
      bd = AppColors.line2;
    } else if (selected) {
      bg = AppColors.ink;
      fg = Colors.white;
      bd = AppColors.ink;
    } else {
      bg = AppColors.surface;
      fg = AppColors.ink;
      bd = AppColors.line2;
    }

    return Opacity(
      opacity: occupied ? 0.7 : 1,
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: bd),
              borderRadius: BorderRadius.circular(14),
            ),
            padding: const EdgeInsets.all(8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  table.isCabin ? 'КАБ' : 'СТОЛ',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                    color: fg.withValues(alpha: 0.55),
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${table.number}',
                  style: numStyle(size: 22, weight: FontWeight.w500, color: fg),
                ),
                if (occupied) ...[
                  const SizedBox(height: 2),
                  Text(
                    'занят',
                    style: GoogleFonts.ibmPlexSans(
                      fontSize: 9,
                      fontWeight: FontWeight.w500,
                      color: AppColors.red,
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
