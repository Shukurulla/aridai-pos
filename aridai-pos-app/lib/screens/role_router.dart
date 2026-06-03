import 'package:flutter/material.dart';

import '../models/user.dart';
import '../utils/app_colors.dart';
import 'home/admin_home.dart';
import 'home/cashier_home.dart';
import 'home/cook_home.dart';
import 'home/owner_home.dart';
import 'home/waiter_home.dart';

/// Picks the right home screen for the logged-in [user] based on [User.role].
class RoleRouter extends StatelessWidget {
  const RoleRouter({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    switch (user.role) {
      case 'waiter':
        return WaiterHome(user: user, onLogout: onLogout);
      case 'cook':
        return CookHome(user: user, onLogout: onLogout);
      case 'cashier':
        return CashierHome(user: user, onLogout: onLogout);
      case 'branch_admin':
        return AdminHome(user: user, onLogout: onLogout);
      case 'owner':
        return OwnerHome(user: user, onLogout: onLogout);
      case 'system_admin':
        // No dedicated system-admin screen yet — fall back to owner view.
        return OwnerHome(user: user, onLogout: onLogout);
      default:
        return _UnknownRoleScreen(role: user.role, onLogout: onLogout);
    }
  }
}

class _UnknownRoleScreen extends StatelessWidget {
  const _UnknownRoleScreen({required this.role, required this.onLogout});

  final String role;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.help_outline,
                  color: AppColors.mute,
                  size: 48,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Неизвестная роль',
                  style: TextStyle(
                    color: AppColors.ink,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  role.isEmpty ? '—' : role,
                  style: const TextStyle(color: AppColors.mute, fontSize: 14),
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: onLogout,
                  icon: const Icon(Icons.logout, size: 18),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.redInk,
                    side: const BorderSide(color: AppColors.red),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
                    ),
                  ),
                  label: const Text('Выйти'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
