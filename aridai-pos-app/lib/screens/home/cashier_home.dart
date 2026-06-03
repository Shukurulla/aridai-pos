import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import '../cashier/payment_page.dart';

/// Home for the cashier role: the list of open (unpaid) orders to settle.
///
/// Shows only orders that still need paying — `!isCancel`, `paymentStatus ==
/// "pending"` and a positive total — newest first. A summary strip totals how
/// much is outstanding. Tapping a card opens the [PaymentPage]; once paid the
/// order drops off the list. Auto-refreshes every 10s plus pull-to-refresh.
class CashierHome extends StatefulWidget {
  const CashierHome({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  State<CashierHome> createState() => _CashierHomeState();
}

class _CashierHomeState extends State<CashierHome> {
  final ApiService _api = ApiService.instance;

  static const Duration _refreshEvery = Duration(seconds: 10);

  bool _isLoading = true;
  String? _error;
  List<OrderModel> _orders = const [];

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

  /// True for orders the cashier still has to settle.
  bool _isOpen(OrderModel o) =>
      !o.isCancel && o.paymentStatus == 'pending' && o.totalPrice > 0;

  /// Fetch orders and keep only the open ones, newest first. [silent] keeps the
  /// current list visible (used by the auto-refresh Timer) so it never flickers.
  Future<void> _load({bool silent = false}) async {
    if (!silent && !_isLoading) setState(() => _isLoading = true);
    try {
      final all = await _api.getOrders();
      final open = all.where(_isOpen).toList()
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
        _orders = open;
        _isLoading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (silent) {
        _showSnack(msg);
      } else {
        setState(() {
          _isLoading = false;
          _error = msg;
        });
      }
    }
  }

  Future<void> _openPayment(OrderModel order) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PaymentPage(
          order: order,
          onPaid: () => Navigator.of(context).pop(),
        ),
      ),
    );
    // Returning from the payment page (paid or just backed out) — refresh so a
    // settled order disappears from the list.
    if (mounted) _load(silent: true);
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

  num get _outstanding =>
      _orders.fold<num>(0, (sum, o) => sum + o.totalPrice);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(),
            if (!_isLoading && _error == null && _orders.isNotEmpty) _summary(),
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
                  'Касса',
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

  /// "К оплате: N заказов · X ₸" strip above the list.
  Widget _summary() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Row(
        children: [
          const Diamond(size: 6, color: AppColors.red),
          const SizedBox(width: 8),
          Text(
            'К оплате: ${_orders.length} ${_orderWord(_orders.length)}',
            style: sansStyle(
              size: 13,
              weight: FontWeight.w500,
              color: AppColors.ink,
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
          Expanded(
            child: Text(
              fmtMoney(_outstanding),
              textAlign: TextAlign.right,
              style: numStyle(
                size: 15,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Russian plural for "заказ": 1 заказ / 2 заказа / 5 заказов.
  String _orderWord(int n) {
    final mod100 = n % 100;
    final mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return 'заказов';
    if (mod10 == 1) return 'заказ';
    if (mod10 >= 2 && mod10 <= 4) return 'заказа';
    return 'заказов';
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
    if (_orders.isEmpty) {
      return _refreshable(
        const WaiterEmpty(
          icon: Icons.point_of_sale_outlined,
          title: 'Нет заказов к оплате',
          sub: 'Новые заказы появятся здесь',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
        itemCount: _orders.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _OpenOrderCard(
            order: _orders[i],
            onTap: () => _openPayment(_orders[i]),
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

/// One open order — receipt, type/table, waiter, position count, time and a
/// prominent total. The whole card is tappable to open the payment page.
class _OpenOrderCard extends StatelessWidget {
  final OrderModel order;
  final VoidCallback onTap;
  const _OpenOrderCard({required this.order, required this.onTap});

  String get _typeLabel {
    if (order.isDineIn && order.tableNumber != null) {
      return 'Зал ${order.tableNumber}';
    }
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
    final itemCount = order.items.fold<int>(0, (s, i) => s + i.quantity);
    final hasWaiter =
        order.waiterName != null && order.waiterName!.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Container(
            decoration: const BoxDecoration(
              border: Border(
                left: BorderSide(color: AppColors.warn, width: 3),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                TableBlock(number: _blockNumber),
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
                              _typeLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: sansStyle(size: 12, color: AppColors.mute),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const StatusChip(
                            label: 'К оплате',
                            fg: AppColors.warn,
                            bg: AppColors.warnSoft,
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.access_time,
                              size: 11, color: AppColors.mute),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              formatTimeAgo(order.createdAt),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: numStyle(size: 11, color: AppColors.mute),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (hasWaiter) ...[
                            Flexible(
                              child: Text(
                                order.waiterName!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style:
                                    sansStyle(size: 11, color: AppColors.mute2),
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
                          ],
                          Text(
                            '$itemCount поз.',
                            style: sansStyle(size: 11, color: AppColors.mute2),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      fmtNumber(order.totalPrice),
                      style: numStyle(
                        size: 18,
                        weight: FontWeight.w600,
                        color: AppColors.ink,
                      ),
                    ),
                    Text(
                      '₸',
                      style: GoogleFonts.ibmPlexSans(
                        fontSize: 10,
                        color: AppColors.mute,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Icon(Icons.chevron_right,
                        size: 18, color: AppColors.mute2),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
