import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/kitchen_item.dart';
import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Home for the cook role: the live kitchen queue.
///
/// Two segments — "Новые" (waiting) / "Готовятся" (cooking). Oldest first
/// (first come, first served). The cook starts a dish ("Начать готовить" →
/// `cooking`) and marks it done ("Готово" → `ready`, which drops it from the
/// queue). Auto-refreshes every 10s plus pull-to-refresh.
class CookHome extends StatefulWidget {
  const CookHome({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  State<CookHome> createState() => _CookHomeState();
}

/// Which segment of the queue is on screen.
enum _Filter { waiting, cooking }

class _CookHomeState extends State<CookHome> {
  final ApiService _api = ApiService.instance;

  static const Duration _refreshEvery = Duration(seconds: 10);

  bool _isLoading = true;
  String? _error;
  List<KitchenItem> _items = const [];
  _Filter _filter = _Filter.waiting;

  /// itemIds whose action call is currently in-flight (button disabled).
  final Set<String> _busy = <String>{};

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(_refreshEvery, (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Fetch the queue. [silent] keeps the current list/spinner visible (used by
  /// the auto-refresh Timer) so the screen never flickers between ticks.
  Future<void> _load({bool silent = false}) async {
    if (!silent && !_isLoading) setState(() => _isLoading = true);
    try {
      final items = await _api.getKitchen()
        ..sort((a, b) {
          final ad = a.createdAt;
          final bd = b.createdAt;
          if (ad == null && bd == null) return 0;
          if (ad == null) return 1;
          if (bd == null) return -1;
          return ad.compareTo(bd); // oldest first — FIFO kitchen queue
        });
      if (!mounted) return;
      setState(() {
        _items = items;
        _isLoading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (silent) {
        // Keep the stale list; just surface the hiccup.
        _showSnack(msg);
      } else {
        setState(() {
          _isLoading = false;
          _error = msg;
        });
      }
    }
  }

  /// Advance one dish, then refresh so it lands in the right segment (or leaves
  /// the queue). Disables the card's button while the call is in-flight.
  Future<void> _advance(KitchenItem item, String status) async {
    if (_busy.contains(item.itemId)) return;
    setState(() => _busy.add(item.itemId));
    try {
      await _api.setCookingStatus(item.orderId, item.itemId, status);
      await _load(silent: true);
    } catch (e) {
      _showSnack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy.remove(item.itemId));
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style:
              sansStyle(size: 13, weight: FontWeight.w500, color: Colors.white),
        ),
        backgroundColor: AppColors.ink,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  List<KitchenItem> get _waiting =>
      _items.where((i) => i.isWaiting).toList(growable: false);
  List<KitchenItem> get _cooking =>
      _items.where((i) => i.isCooking).toList(growable: false);

  List<KitchenItem> get _visible =>
      _filter == _Filter.waiting ? _waiting : _cooking;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(),
            _filters(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    final u = _api.currentUser ?? widget.user;
    final place = u.branchName ?? u.restaurantName;
    final subtitle = [
      if (u.name.isNotEmpty) u.name,
      if (place != null && place.isNotEmpty) place,
    ].join(' · ');

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 12, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Кухня',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: sansStyle(size: 11, color: AppColors.mute),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            tooltip: 'Выйти',
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout, size: 20, color: AppColors.ink),
          ),
        ],
      ),
    );
  }

  Widget _filters() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 6),
      child: Row(
        children: [
          WaiterChip(
            label: 'Новые',
            active: _filter == _Filter.waiting,
            count: _waiting.length,
            onTap: () => setState(() => _filter = _Filter.waiting),
          ),
          const SizedBox(width: 8),
          WaiterChip(
            label: 'Готовятся',
            active: _filter == _Filter.cooking,
            count: _cooking.length,
            onTap: () => setState(() => _filter = _Filter.cooking),
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
      return _refreshable(
        WaiterEmpty(
          icon: Icons.error_outline,
          title: 'Не удалось загрузить',
          sub: _error,
        ),
      );
    }
    final list = _visible;
    if (list.isEmpty) {
      final waiting = _filter == _Filter.waiting;
      return _refreshable(
        WaiterEmpty(
          icon: waiting
              ? Icons.ramen_dining_outlined
              : Icons.outdoor_grill_outlined,
          title: waiting ? 'Очередь пуста' : 'Нет блюд в работе',
          sub: waiting
              ? 'Новые блюда появятся здесь'
              : 'Начните готовить блюдо из очереди',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        itemCount: list.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _KitchenCard(
            item: list[i],
            busy: _busy.contains(list[i].itemId),
            onAction: () => _advance(
              list[i],
              list[i].isWaiting ? 'cooking' : 'ready',
            ),
          ),
        ),
      ),
    );
  }

  /// A scrollable wrapper so pull-to-refresh works on empty / error states.
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
}

/// One queued dish: name + qty, source, optional note, time, and the
/// stage-advancing action button.
class _KitchenCard extends StatelessWidget {
  final KitchenItem item;
  final bool busy;
  final VoidCallback onAction;
  const _KitchenCard({
    required this.item,
    required this.busy,
    required this.onAction,
  });

  /// Where the dish goes — "Стол N" for dine-in, else the order type.
  String get _source {
    if (item.isDineIn) {
      if (item.tableNumber != null) return 'Стол ${item.tableNumber}';
      if (item.tableTitle != null) return item.tableTitle!;
      return 'Зал';
    }
    switch (item.orderType) {
      case 'takeaway':
        return 'Собой';
      case 'delivery':
        return 'Доставка';
      default:
        return 'Зал';
    }
  }

  String get _receipt {
    final r = item.receiptNumber;
    return r.isEmpty ? '#—' : '#$r';
  }

  @override
  Widget build(BuildContext context) {
    final waiting = item.isWaiting;
    final accent = waiting ? AppColors.red : AppColors.ok;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: accent, width: 3)),
        ),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: source + receipt + status chip.
            Row(
              children: [
                Icon(
                  item.isDineIn
                      ? Icons.table_restaurant_outlined
                      : Icons.takeout_dining_outlined,
                  size: 13,
                  color: AppColors.mute,
                ),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    _source,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: sansStyle(
                      size: 12,
                      weight: FontWeight.w500,
                      color: AppColors.mute,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _receipt,
                  style: numStyle(size: 11, color: AppColors.mute2),
                ),
                const Spacer(),
                StatusChip(
                  label: waiting ? 'Новое' : 'Готовится',
                  fg: accent,
                  bg: waiting ? AppColors.redSoft : AppColors.okSoft,
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Dish name (large, bold) + prominent quantity.
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    item.foodName.isEmpty ? 'Без названия' : item.foodName,
                    style: GoogleFonts.ibmPlexSans(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                      letterSpacing: -0.3,
                      height: 1.2,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.ink,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '× ${item.quantity}',
                    style: numStyle(
                      size: 16,
                      weight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            // Optional note (italic).
            if (item.note != null) ...[
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.sticky_note_2_outlined,
                      size: 13, color: AppColors.warn),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      item.note!,
                      style: sansStyle(size: 13, color: AppColors.ink2)
                          .copyWith(fontStyle: FontStyle.italic),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            // Time + action.
            Row(
              children: [
                const Icon(Icons.access_time, size: 12, color: AppColors.mute),
                const SizedBox(width: 4),
                Text(
                  formatTimeAgo(item.createdAt),
                  style: numStyle(size: 11, color: AppColors.mute),
                ),
                const Spacer(),
                _ActionButton(
                  label: waiting ? 'Начать готовить' : 'Готово',
                  color: accent,
                  busy: busy,
                  onTap: onAction,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Filled pill action button. Shows a spinner + disables itself while [busy].
class _ActionButton extends StatelessWidget {
  final String label;
  final Color color;
  final bool busy;
  final VoidCallback onTap;
  const _ActionButton({
    required this.label,
    required this.color,
    required this.busy,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy) ...[
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: sansStyle(
                  size: 13,
                  weight: FontWeight.w600,
                  color: Colors.white,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
