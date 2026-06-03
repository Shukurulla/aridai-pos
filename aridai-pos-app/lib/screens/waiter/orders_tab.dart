import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'order_detail_screen.dart';

/// Read-only list of THIS waiter's orders (newest first). Live-refreshes on
/// `orders:changed` socket events (with pull-to-refresh + a 10s timer as
/// fallbacks). Tapping a card opens [OrderDetailScreen].
class OrdersTab extends StatefulWidget {
  const OrdersTab({super.key, required this.user});

  final User user;

  @override
  State<OrdersTab> createState() => OrdersTabState();
}

class OrdersTabState extends State<OrdersTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<OrderModel> _orders = const [];

  StreamSubscription<void>? _socketSub;
  Timer? _pollTimer;

  /// Reload the list (used by the socket, the timer, and the parent after an
  /// order is created).
  void reload() => _load();

  @override
  void initState() {
    super.initState();
    _load();
    _socketSub = SocketService.instance.onOrdersChanged.listen((_) {
      if (mounted) _load();
    });
    _pollTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) {
        if (mounted && !_isLoading) _load();
      },
    );
  }

  @override
  void dispose() {
    _socketSub?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final all = await _api.getOrders();
      final mine = all.where((o) => o.waiterId == widget.user.id).toList()
        ..sort((a, b) {
          final ad = a.createdAt;
          final bd = b.createdAt;
          if (ad == null && bd == null) return 0;
          if (ad == null) return 1;
          if (bd == null) return -1;
          return bd.compareTo(ad); // newest first
        });
      if (!mounted) return;
      setState(() {
        _orders = mine;
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
    final active = _orders
        .where((o) => !o.isCancel && !o.isPaid)
        .length;
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
                  'Заказы',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _isLoading
                      ? 'Загрузка…'
                      : '${_orders.length} всего · $active активных',
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          _RefreshButton(onTap: _isLoading ? null : _load),
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
    if (_orders.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        color: AppColors.red,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: const WaiterEmpty(
                icon: Icons.receipt_long_outlined,
                title: 'Заказов пока нет',
                sub: 'Ваши заказы появятся здесь',
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
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 100),
        itemCount: _orders.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _OrderCard(
            order: _orders[i],
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => OrderDetailScreen(order: _orders[i]),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _RefreshButton extends StatelessWidget {
  final VoidCallback? onTap;
  const _RefreshButton({this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.line2),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: const SizedBox(
          width: 36,
          height: 36,
          child: Icon(Icons.refresh, size: 18, color: AppColors.ink),
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final OrderModel order;
  final VoidCallback onTap;
  const _OrderCard({required this.order, required this.onTap});

  /// (label, foreground, background) for the status chip.
  ({String label, Color fg, Color bg}) get _status {
    if (order.isCancel) {
      return (label: 'Отменён', fg: AppColors.red, bg: AppColors.redSoft);
    }
    if (order.isPaid) {
      return (label: 'Оплачен', fg: AppColors.ok, bg: AppColors.okSoft);
    }
    return (label: 'Открыт', fg: AppColors.warn, bg: AppColors.warnSoft);
  }

  String get _typeLabel {
    switch (order.orderType) {
      case 'takeaway':
        return 'Собой';
      case 'delivery':
        return 'Доставка';
      default:
        return 'Зал';
    }
  }

  String get _receipt {
    final r = order.receiptNumber;
    return r.isEmpty ? '#—' : '#$r';
  }

  String get _blockNumber {
    if (order.tableNumber != null) return '${order.tableNumber}';
    switch (order.orderType) {
      case 'takeaway':
        return 'С';
      case 'delivery':
        return 'Д';
      default:
        return '—';
    }
  }

  @override
  Widget build(BuildContext context) {
    final st = _status;
    final muted = order.isCancel;
    // Item preview — first 3 lines like the reference order card, plus an
    // "+ ещё N" overflow note.
    final preview = order.items.take(3).toList();
    final more = order.items.length - preview.length;
    final sub = order.isDineIn && order.tableNumber != null
        ? '$_typeLabel · Стол ${order.tableNumber}'
        : _typeLabel;

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(14),
          ),
          clipBehavior: Clip.antiAlias,
          child: Container(
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: st.fg, width: 3)),
            ),
            child: Column(
              children: [
                // Head row.
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      TableBlock(number: _blockNumber, accent: muted),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    _receipt,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: numStyle(
                                      size: 14,
                                      weight: FontWeight.w500,
                                      color: AppColors.ink,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 3,
                                  height: 3,
                                  decoration: const BoxDecoration(
                                    color: AppColors.mute2,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    sub,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style:
                                        sansStyle(size: 12, color: AppColors.mute),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                StatusChip(label: st.label, fg: st.fg, bg: st.bg),
                                const SizedBox(width: 8),
                                const Text('·',
                                    style: TextStyle(color: AppColors.mute2)),
                                const SizedBox(width: 8),
                                const Icon(Icons.access_time,
                                    size: 11, color: AppColors.mute),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    formatTimeAgo(order.createdAt),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style:
                                        numStyle(size: 11, color: AppColors.mute),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      MoneyTg(amount: order.totalPrice, muted: muted),
                    ],
                  ),
                ),
                // Items preview.
                if (preview.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: Column(
                      children: [
                        for (final it in preview)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 26,
                                  child: Text(
                                    '×${it.quantity}',
                                    style: numStyle(
                                      size: 12,
                                      color: AppColors.mute,
                                      weight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    it.foodName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: sansStyle(
                                      size: 12,
                                      color: AppColors.ink2,
                                    ).copyWith(
                                      decoration: muted
                                          ? TextDecoration.lineThrough
                                          : TextDecoration.none,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  fmtNumber(it.foodPrice * it.quantity),
                                  style:
                                      numStyle(size: 12, color: AppColors.mute),
                                ),
                              ],
                            ),
                          ),
                        if (more > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                '+ ещё $more позиции',
                                style:
                                    sansStyle(size: 11, color: AppColors.mute2),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
