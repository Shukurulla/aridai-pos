import 'package:flutter/material.dart';

import '../services/branch_status_service.dart';
import '../utils/app_colors.dart';
import '../utils/waiter_design.dart';

/// Thin amber bar shown when the branch is offline (its local POS backend
/// stopped syncing). Collapses to nothing while online. Listens to
/// [BranchStatusService] so it appears/disappears automatically.
///
/// Place it directly under a screen's header.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, this.message});

  /// Optional override for the banner text.
  final String? message;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: BranchStatusService.instance.online,
      builder: (context, online, _) {
        if (online) return const SizedBox.shrink();
        return Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: AppColors.warnSoft,
            border: Border(bottom: BorderSide(color: AppColors.line)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          child: Row(
            children: [
              const Icon(Icons.cloud_off_outlined, size: 16, color: AppColors.warn),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  message ?? 'Филиал офлайн — оформляйте заказы через POS',
                  style: sansStyle(
                    size: 12,
                    weight: FontWeight.w500,
                    color: AppColors.warn,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
