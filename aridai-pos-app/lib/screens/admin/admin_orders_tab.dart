import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';

/// Branch-admin orders feed — every order of the branch, newest first, with a
/// status filter and an "Отменить" action on still-open orders.
class AdminOrdersTab extends StatefulWidget {
  const AdminOrdersTab({super.key});

  @override
  State<AdminOrdersTab> createState() => _AdminOrdersTabState();
}

enum _Filter { all, open, paid, cancelled }

class _AdminOrdersTabState extends State<AdminOrdersTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<OrderModel> _orders = const [];
  _Filter _filter = _Filter.all;

  /// orderIds whose cancel call is in-flight.
  final Set<String> _busy = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final all = await _api.getOrders()
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
        _orders = all;
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

  bool _isOpen(OrderModel o) => !o.isCancel && !o.isPaid;

  List<OrderModel> get _visible {
    switch (_filter) {
      case _Filter.open:
        return _orders.where(_isOpen).toList(growable: false);
      case _Filter.paid:
        return _orders.where((o) => o.isPaid && !o.isCancel).toList(
              growable: false,
            );
      case _Filter.cancelled:
        return _orders.where((o) => o.isCancel).toList(growable: false);
      case _Filter.all:
        return _orders;
    }
  }

  Future<void> _cancel(OrderModel order) async {
    final reason = await _askReason(order);
    if (reason == null) return; // dismissed
    if (_busy.contains(order.id)) return;
    setState(() => _busy.add(order.id));
    try {
      await _api.cancelOrder(order.id, reason);
      await _load();
      if (mounted) showAdminSnack(context, 'Заказ отменён');
    } catch (e) {
      if (mounted) {
        showAdminSnack(context, e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy.remove(order.id));
    }
  }

  /// Prompt for a cancellation reason. Returns the (non-empty) reason, or null
  /// if the dialog was dismissed.
  Future<String?> _askReason(OrderModel order) async {
    final controller = TextEditingController();
    final receipt =
        order.receiptNumber.isEmpty ? '' : ' #${order.receiptNumber}';
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Text(
          'Отменить заказ$receipt',
          style: sansStyle(size: 16, weight: FontWeight.w600),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Укажите причину отмены',
              style: sansStyle(size: 13, color: AppColors.mute),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              minLines: 1,
              maxLines: 3,
              style: sansStyle(size: 14, color: AppColors.ink),
              decoration: InputDecoration(
                hintText: 'Напр. ошибка официанта',
                hintStyle: sansStyle(size: 14, color: AppColors.mute2),
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
              ),
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Отмена',
              style: sansStyle(size: 14, color: AppColors.mute),
            ),
          ),
          AdminButton(
            label: 'Отменить заказ',
            color: AppColors.red,
            onTap: () {
              final text = controller.text.trim();
              Navigator.of(ctx).pop(text.isEmpty ? 'Без причины' : text);
            },
          ),
        ],
      ),
    );
    controller.dispose();
    return reason;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AdminHeader(
              title: 'Заказы',
              subtitle: _isLoading
                  ? 'Загрузка…'
                  : '${_orders.length} всего · '
                      '${_orders.where(_isOpen).length} открытых',
              trailing: AdminRefreshButton(onTap: _isLoading ? null : _load),
            ),
            if (!_isLoading && _error == null) _filters(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _filters() {
    final open = _orders.where(_isOpen).length;
    final paid = _orders.where((o) => o.isPaid && !o.isCancel).length;
    final cancelled = _orders.where((o) => o.isCancel).length;
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
              active: _filter == _Filter.all,
              count: _orders.length,
              onTap: () => setState(() => _filter = _Filter.all),
            ),
            const SizedBox(width: 8),
            WaiterChip(
              label: 'Открытые',
              active: _filter == _Filter.open,
              count: open,
              onTap: () => setState(() => _filter = _Filter.open),
            ),
            const SizedBox(width: 8),
            WaiterChip(
              label: 'Оплаченные',
              active: _filter == _Filter.paid,
              count: paid,
              onTap: () => setState(() => _filter = _Filter.paid),
            ),
            const SizedBox(width: 8),
            WaiterChip(
              label: 'Отменённые',
              active: _filter == _Filter.cancelled,
              count: cancelled,
              onTap: () => setState(() => _filter = _Filter.cancelled),
            ),
          ],
        ),
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
      return _refreshable(
        const WaiterEmpty(
          icon: Icons.receipt_long_outlined,
          title: 'Заказов нет',
          sub: 'Здесь появятся заказы филиала',
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
        itemCount: list.length,
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _OrderCard(
            order: list[i],
            busy: _busy.contains(list[i].id),
            onCancel: _isOpen(list[i]) ? () => _cancel(list[i]) : null,
          ),
        ),
      ),
    );
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
}

/// One order card — receipt, type/table, status chip, time, position count,
/// total and (for open orders) an "Отменить" action.
class _OrderCard extends StatelessWidget {
  final OrderModel order;
  final bool busy;
  final VoidCallback? onCancel;
  const _OrderCard({
    required this.order,
    required this.busy,
    required this.onCancel,
  });

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
    final itemCount = order.items.fold<int>(0, (s, i) => s + i.quantity);
    final muted = order.isCancel;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: st.fg, width: 3)),
        ),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
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
                              order.isDineIn && order.tableNumber != null
                                  ? '$_typeLabel · Стол ${order.tableNumber}'
                                  : _typeLabel,
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
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          if (order.waiterName != null &&
                              order.waiterName!.isNotEmpty) ...[
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
                            style:
                                sansStyle(size: 11, color: AppColors.mute2),
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
                        size: 16,
                        weight: FontWeight.w500,
                        color: muted ? AppColors.red : AppColors.ink,
                      ).copyWith(
                        decoration: muted
                            ? TextDecoration.lineThrough
                            : TextDecoration.none,
                        decorationColor: AppColors.red,
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
                  ],
                ),
              ],
            ),
            if (onCancel != null) ...[
              const SizedBox(height: 12),
              const Divider(height: 1, color: AppColors.line),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: _CancelButton(busy: busy, onTap: onCancel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Subtle red outlined "Отменить" pill (only on open orders).
class _CancelButton extends StatelessWidget {
  final bool busy;
  final VoidCallback onTap;
  const _CancelButton({required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.redSoft,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                const SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.red),
                  ),
                )
              else
                const Icon(Icons.close_rounded, size: 14, color: AppColors.red),
              const SizedBox(width: 6),
              Text(
                'Отменить',
                style: sansStyle(
                  size: 12,
                  weight: FontWeight.w600,
                  color: AppColors.red,
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
