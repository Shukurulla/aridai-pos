import 'package:flutter/material.dart';

import '../../models/user.dart';
import '../../utils/app_colors.dart';

/// Shared placeholder scaffold used by every role-home stub.
///
/// Real role features land here later — for now each role just shows its label
/// and a "coming soon" body so routing can be verified end-to-end.
class RoleHomeScaffold extends StatelessWidget {
  const RoleHomeScaffold({
    super.key,
    required this.roleLabel,
    required this.user,
    required this.onLogout,
  });

  final String roleLabel;
  final User user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final place = user.branchName ?? user.restaurantName;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              roleLabel,
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (place != null && place.isNotEmpty)
              Text(
                place,
                style: const TextStyle(
                  color: AppColors.mute,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Выйти',
            onPressed: onLogout,
            icon: const Icon(Icons.logout, color: AppColors.ink),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.redSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.construction_outlined,
                color: AppColors.redInk,
                size: 36,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              roleLabel,
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Скоро',
              style: TextStyle(
                color: AppColors.mute,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'В разработке',
              style: TextStyle(color: AppColors.mute2, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
