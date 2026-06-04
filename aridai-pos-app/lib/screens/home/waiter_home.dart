import 'package:flutter/material.dart';

import '../../models/user.dart';
import '../../services/branch_status_service.dart';
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
    // Blocked only when offline AND not in possiz mode. In possiz, mobile
    // ordering works (orders go to the global backend); see possiz-rejim.md.
    final svc = BranchStatusService.instance;
    if (!svc.online.value && !svc.possiz.value) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Филиал офлайн — оформляйте заказы через POS',
            style: sansStyle(
                size: 13, weight: FontWeight.w500, color: Colors.white),
          ),
          backgroundColor: AppColors.warn,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 3),
        ),
      );
      return;
    }
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
    // The "+ Новый заказ" action only exists on the Заказы / Столы tabs.
    final showFab = _index == 0 || _index == 1;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: IndexedStack(index: _index, children: _tabs),
      extendBody: true,
      bottomNavigationBar: _BottomBar(
        index: _index,
        showFab: showFab,
        onTap: (i) => setState(() => _index = i),
        onFab: _newOrder,
      ),
    );
  }
}

/// Black bottom-nav bar with a floating red "+" FAB centred on its top edge —
/// ported from the reference `main_screen` so the shell matches screen-for-
/// screen. The FAB runs [onFab] (the same "+ Новый заказ" flow) and only
/// appears on the tabs where creating an order is allowed.
class _BottomBar extends StatelessWidget {
  final int index;
  final bool showFab;
  final ValueChanged<int> onTap;
  final VoidCallback onFab;
  const _BottomBar({
    required this.index,
    required this.showFab,
    required this.onTap,
    required this.onFab,
  });

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
    return SizedBox(
      height: 100,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Main black bar with rounded top corners.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: AppColors.ink,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.only(top: 14, bottom: 6),
                  child: Row(
                    children: List.generate(_items.length, (i) {
                      return Expanded(
                        child: Align(
                          alignment: Alignment.topCenter,
                          child: _NavItem(
                            item: _items[i],
                            active: index == i,
                            onTap: () => onTap(i),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
            ),
          ),
          // Centred floating red FAB — the "+ Новый заказ" action.
          if (showFab)
            Positioned(
              top: -28,
              left: 0,
              right: 0,
              child: Center(child: _CenterFab(onTap: onFab)),
            ),
        ],
      ),
    );
  }
}

/// Floating red circle "+" button that hovers over the nav bar.
class _CenterFab extends StatelessWidget {
  final VoidCallback onTap;
  const _CenterFab({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 60,
        height: 60,
        decoration: BoxDecoration(
          color: AppColors.red,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.red.withValues(alpha: 0.5),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
            const BoxShadow(
              color: AppColors.redInk,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
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
