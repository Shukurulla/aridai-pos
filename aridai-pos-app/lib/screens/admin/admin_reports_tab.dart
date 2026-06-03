import 'package:flutter/material.dart';

import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';

/// Branch-admin reports — client-side stats over the branch orders, with a
/// period filter (Today / 7 days / All) and a top-dishes list.
class AdminReportsTab extends StatefulWidget {
  const AdminReportsTab({super.key});

  @override
  State<AdminReportsTab> createState() => _AdminReportsTabState();
}

enum _Period { today, week, all }

class _AdminReportsTabState extends State<AdminReportsTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<OrderModel> _orders = const [];
  _Period _period = _Period.today;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final all = await _api.getOrders();
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

  /// Orders within the active period (by createdAt). Undated orders only count
  /// in the "Всё" period.
  List<OrderModel> get _inPeriod {
    if (_period == _Period.all) return _orders;
    final now = DateTime.now();
    final DateTime from = _period == _Period.today
        ? DateTime(now.year, now.month, now.day)
        : now.subtract(const Duration(days: 7));
    return _orders.where((o) {
      final d = o.createdAt;
      if (d == null) return false;
      return d.isAfter(from);
    }).toList(growable: false);
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
              title: 'Отчёты',
              subtitle: _isLoading ? 'Загрузка…' : 'Статистика филиала',
              trailing: AdminRefreshButton(onTap: _isLoading ? null : _load),
            ),
            if (!_isLoading && _error == null) _periodBar(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _periodBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Row(
        children: [
          WaiterChip(
            label: 'Сегодня',
            active: _period == _Period.today,
            onTap: () => setState(() => _period = _Period.today),
          ),
          const SizedBox(width: 8),
          WaiterChip(
            label: '7 дней',
            active: _period == _Period.week,
            onTap: () => setState(() => _period = _Period.week),
          ),
          const SizedBox(width: 8),
          WaiterChip(
            label: 'Всё',
            active: _period == _Period.all,
            onTap: () => setState(() => _period = _Period.all),
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

    final orders = _inPeriod;
    // Paid, non-cancelled orders drive revenue + average cheque.
    final paid =
        orders.where((o) => o.isPaid && !o.isCancel).toList(growable: false);
    final cancelled = orders.where((o) => o.isCancel).length;
    final revenue = paid.fold<num>(0, (s, o) => s + o.totalPrice);
    final avg = paid.isEmpty ? 0 : revenue / paid.length;
    final top = _topDishes(orders);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        children: [
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  label: 'Выручка',
                  value: fmtMoney(revenue),
                  icon: Icons.payments_outlined,
                  accent: true,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  label: 'Заказов',
                  value: fmtNumber(paid.length),
                  icon: Icons.receipt_long_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  label: 'Средний чек',
                  value: fmtMoney(avg),
                  icon: Icons.trending_up_rounded,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  label: 'Отменено',
                  value: fmtNumber(cancelled),
                  icon: Icons.cancel_outlined,
                  danger: cancelled > 0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const SectionHeader(title: 'ТОП блюд', sub: 'По количеству продаж'),
          if (top.isEmpty)
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
              alignment: Alignment.center,
              child: Text(
                'Нет данных за период',
                style: sansStyle(size: 13, color: AppColors.mute),
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(14),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (int i = 0; i < top.length; i++) ...[
                    if (i > 0)
                      const Divider(height: 1, color: AppColors.line),
                    _TopRow(rank: i + 1, dish: top[i]),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// Aggregate `foodName × quantity` over non-cancelled orders, top 5.
  List<_Dish> _topDishes(List<OrderModel> orders) {
    final byName = <String, _Dish>{};
    for (final o in orders) {
      if (o.isCancel) continue;
      for (final item in o.items) {
        final name = item.foodName.isEmpty ? 'Без названия' : item.foodName;
        final existing = byName[name];
        if (existing == null) {
          byName[name] = _Dish(
            name: name,
            qty: item.quantity,
            revenue: item.foodPrice * item.quantity,
          );
        } else {
          byName[name] = _Dish(
            name: name,
            qty: existing.qty + item.quantity,
            revenue: existing.revenue + item.foodPrice * item.quantity,
          );
        }
      }
    }
    final list = byName.values.toList()
      ..sort((a, b) => b.qty.compareTo(a.qty));
    return list.take(5).toList(growable: false);
  }

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: child,
          ),
        ],
      ),
    );
  }
}

/// Aggregated dish row for the ТОП list.
class _Dish {
  final String name;
  final int qty;
  final num revenue;
  const _Dish({required this.name, required this.qty, required this.revenue});
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool accent;
  final bool danger;
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.accent = false,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final Color iconBg = danger
        ? AppColors.redSoft
        : accent
            ? AppColors.okSoft
            : AppColors.surface2;
    final Color iconFg = danger
        ? AppColors.red
        : accent
            ? AppColors.ok
            : AppColors.mute;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconFg, size: 18),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: numStyle(
              size: 18,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: sansStyle(size: 11, color: AppColors.mute),
          ),
        ],
      ),
    );
  }
}

class _TopRow extends StatelessWidget {
  final int rank;
  final _Dish dish;
  const _TopRow({required this.rank, required this.dish});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: rank == 1 ? AppColors.ink : AppColors.surface2,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$rank',
              style: numStyle(
                size: 12,
                weight: FontWeight.w600,
                color: rank == 1 ? Colors.white : AppColors.mute,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dish.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fmtMoney(dish.revenue),
                  style: numStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '× ${dish.qty}',
              style: numStyle(
                size: 13,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
