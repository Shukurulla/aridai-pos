import 'package:flutter/material.dart';

import '../services/branch_status_service.dart';
import '../utils/app_colors.dart';
import '../utils/waiter_design.dart';

/// Status bar shown under a screen header:
/// • **Possiz** (red) — admin-activated emergency mode: ordering works through
///   the phone, cooks get notifications.
/// • **Offline** (amber) — the branch lost its POS sync: order via POS instead.
/// • Online — collapses to nothing.
///
/// Listens to [BranchStatusService] so it appears/updates automatically.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final svc = BranchStatusService.instance;
    return AnimatedBuilder(
      animation: Listenable.merge([svc.online, svc.possiz]),
      builder: (context, _) {
        if (svc.possiz.value) {
          return _bar(
            bg: AppColors.redSoft,
            fg: AppColors.red,
            icon: Icons.bolt_rounded,
            text: 'Режим ПОССИЗ — заказы принимаются через телефон',
          );
        }
        if (!svc.online.value) {
          return _bar(
            bg: AppColors.warnSoft,
            fg: AppColors.warn,
            icon: Icons.cloud_off_outlined,
            text: 'Филиал офлайн — оформляйте заказы через POS',
          );
        }
        return const SizedBox.shrink();
      },
    );
  }

  Widget _bar({
    required Color bg,
    required Color fg,
    required IconData icon,
    required String text,
  }) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: bg,
        border: const Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      child: Row(
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: sansStyle(size: 12, weight: FontWeight.w500, color: fg),
            ),
          ),
        ],
      ),
    );
  }
}
