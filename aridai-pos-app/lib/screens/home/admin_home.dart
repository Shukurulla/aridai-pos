import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import '../admin/admin_menu_tab.dart';
import '../admin/admin_orders_tab.dart';
import '../admin/admin_reports_tab.dart';
import '../admin/admin_shift_tab.dart';
import '../admin/admin_staff_tab.dart';

/// Home for the branch-admin role: a bottom-nav shell over four screens —
/// Заказы / Сотрудники / Отчёты / Смена — with a slim top header showing the
/// branch + admin name and a logout button.
class AdminHome extends StatefulWidget {
  const AdminHome({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  State<AdminHome> createState() => _AdminHomeState();
}

class _AdminHomeState extends State<AdminHome> {
  int _index = 0;

  static const _tabs = <Widget>[
    AdminOrdersTab(),
    AdminMenuTab(),
    AdminStaffTab(),
    AdminReportsTab(),
    AdminShiftTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          _TopBar(user: widget.user, onLogout: widget.onLogout),
          Expanded(
            child: IndexedStack(index: _index, children: _tabs),
          ),
        ],
      ),
      bottomNavigationBar: _BottomBar(
        index: _index,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }
}

/// Slim header above the tab body: branch name + admin name + logout.
class _TopBar extends StatelessWidget {
  final User user;
  final VoidCallback onLogout;
  const _TopBar({required this.user, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    final u = ApiService.instance.currentUser ?? user;
    final place = u.branchName ?? u.restaurantName ?? 'Филиал';
    final name = u.name.isEmpty ? 'Администратор' : u.name;

    return Container(
      decoration: const BoxDecoration(color: AppColors.ink),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 8, 10),
          child: Row(
            children: [
              const Diamond(size: 7, color: AppColors.red),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      place,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.ibmPlexSans(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '$name · Администратор',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.ibmPlexSans(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.6),
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Выйти',
                onPressed: onLogout,
                icon: Icon(
                  Icons.logout,
                  size: 20,
                  color: Colors.white.withValues(alpha: 0.85),
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
      icon: Icons.restaurant_menu_outlined,
      active: Icons.restaurant_menu_rounded,
      label: 'Меню'
    ),
    (
      icon: Icons.group_outlined,
      active: Icons.group_rounded,
      label: 'Сотрудники'
    ),
    (
      icon: Icons.bar_chart_outlined,
      active: Icons.bar_chart_rounded,
      label: 'Отчёты'
    ),
    (
      icon: Icons.point_of_sale_outlined,
      active: Icons.point_of_sale_rounded,
      label: 'Смена'
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
