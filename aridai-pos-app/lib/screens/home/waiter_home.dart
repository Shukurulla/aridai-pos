import 'package:flutter/material.dart';

import '../../models/user.dart';
import '../../services/socket_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import '../waiter/create_order_screen.dart';
import '../waiter/menu_tab.dart';
import '../waiter/orders_tab.dart';
import '../waiter/profile_tab.dart';
import '../waiter/tables_tab.dart';

/// Home for the waiter role: a bottom-nav shell over Заказы / Столы / Меню /
/// Профиль, plus a red "+ Новый заказ" action. Opens the real-time socket so
/// the orders & tables tabs live-refresh on `orders:changed`.
class WaiterHome extends StatefulWidget {
  const WaiterHome({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  State<WaiterHome> createState() => _WaiterHomeState();
}

class _WaiterHomeState extends State<WaiterHome> {
  int _index = 0;

  final GlobalKey<OrdersTabState> _ordersKey = GlobalKey<OrdersTabState>();
  final GlobalKey<TablesTabState> _tablesKey = GlobalKey<TablesTabState>();

  late final List<Widget> _tabs = [
    OrdersTab(key: _ordersKey, user: widget.user),
    TablesTab(key: _tablesKey),
    const MenuTab(),
    ProfileTab(user: widget.user, onLogout: widget.onLogout),
  ];

  @override
  void initState() {
    super.initState();
    // Real-time updates; tolerates being offline (no crash).
    SocketService.instance.connect();
  }

  Future<void> _newOrder() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const CreateOrderScreen()),
    );
    if (!mounted || created != true) return;
    setState(() => _index = 0); // switch to Заказы
    _ordersKey.currentState?.reload();
    _tablesKey.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: IndexedStack(index: _index, children: _tabs),
      floatingActionButton: (_index == 0 || _index == 1)
          ? _NewOrderButton(onTap: _newOrder)
          : null,
      bottomNavigationBar: _BottomBar(
        index: _index,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }
}

/// Red pill FAB — "+ Новый заказ".
class _NewOrderButton extends StatelessWidget {
  final VoidCallback onTap;
  const _NewOrderButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.red,
      borderRadius: BorderRadius.circular(14),
      elevation: 3,
      shadowColor: AppColors.red.withValues(alpha: 0.4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.add, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                'Новый заказ',
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

class _BottomBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  const _BottomBar({required this.index, required this.onTap});

  static const _items = <({IconData icon, IconData active, String label})>[
    (
      icon: Icons.receipt_long_outlined,
      active: Icons.receipt_long_rounded,
      label: 'Заказы'
    ),
    (
      icon: Icons.table_restaurant_outlined,
      active: Icons.table_restaurant_rounded,
      label: 'Столы'
    ),
    (
      icon: Icons.restaurant_menu_outlined,
      active: Icons.restaurant_menu_rounded,
      label: 'Меню'
    ),
    (
      icon: Icons.person_outline_rounded,
      active: Icons.person_rounded,
      label: 'Профиль'
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 12, bottom: 6),
          child: Row(
            children: List.generate(_items.length, (i) {
              return Expanded(
                child: _NavItem(
                  item: _items[i],
                  active: index == i,
                  onTap: () => onTap(i),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final ({IconData icon, IconData active, String label}) item;
  final bool active;
  final VoidCallback onTap;
  const _NavItem({
    required this.item,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final inactive = Colors.white.withValues(alpha: 0.45);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              active ? item.active : item.icon,
              color: active ? AppColors.red : inactive,
              size: 22,
            ),
            const SizedBox(height: 5),
            Text(
              item.label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: active ? Colors.white : inactive,
                fontSize: 10,
                fontWeight: active ? FontWeight.w500 : FontWeight.w400,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              height: 6,
              child: active
                  ? const Center(child: Diamond(size: 5, color: AppColors.red))
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
