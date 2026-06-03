import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Small shared bits for the branch-admin screens — role/salary labels, a
/// consistent screen header, a refresh button, a primary/secondary button and
/// a snackbar helper. Keeps the four admin tabs visually identical to the
/// waiter/cook homes without duplicating boilerplate.

/// Russian label for a staff [role].
String roleLabel(String role) {
  switch (role) {
    case 'waiter':
      return 'Официант';
    case 'cook':
      return 'Повар';
    case 'cashier':
      return 'Кассир';
    case 'branch_admin':
      return 'Администратор';
    case 'owner':
      return 'Владелец';
    case 'system_admin':
      return 'Системный администратор';
    default:
      return role.isEmpty ? 'Сотрудник' : role;
  }
}

/// Human-readable salary line, e.g. `Дневная · 5 000 ₸` or `С заказов · 10%`.
/// Returns null when no salary is configured.
String? salaryLabel(String mode, num amount) {
  switch (mode) {
    case 'daily':
      return 'Дневная · ${fmtMoney(amount)}';
    case 'monthly':
      return 'Месячная · ${fmtMoney(amount)}';
    case 'percent':
      return 'С заказов · ${fmtNumber(amount)}%';
    default:
      return null;
  }
}

/// Show a floating dark snackbar (matches the cook screen).
void showAdminSnack(BuildContext context, String message) {
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

/// Standard tab header: title + subtitle on the left, optional trailing widget.
class AdminHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  const AdminHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
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
                  title,
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: sansStyle(size: 11, color: AppColors.mute),
                  ),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Small bordered square refresh button (matches the waiter orders tab).
class AdminRefreshButton extends StatelessWidget {
  final VoidCallback? onTap;
  const AdminRefreshButton({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.line2),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: const SizedBox(
          width: 36,
          height: 36,
          child: Icon(Icons.refresh, size: 18, color: AppColors.ink),
        ),
      ),
    );
  }
}

/// Filled pill button (red by default). Shows a spinner + disables while busy.
class AdminButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color color;
  final bool busy;
  final bool expand;
  final VoidCallback? onTap;
  const AdminButton({
    super.key,
    required this.label,
    this.icon,
    this.color = AppColors.red,
    this.busy = false,
    this.expand = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final child = Material(
      color: onTap == null ? color.withValues(alpha: 0.5) : color,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy) ...[
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                const SizedBox(width: 8),
              ] else if (icon != null) ...[
                Icon(icon, size: 16, color: Colors.white),
                const SizedBox(width: 8),
              ],
              Text(
                label,
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
    return expand ? SizedBox(width: double.infinity, child: child) : child;
  }
}

/// Outlined (secondary) pill button.
class AdminOutlineButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color color;
  final bool expand;
  final VoidCallback? onTap;
  const AdminOutlineButton({
    super.key,
    required this.label,
    this.icon,
    this.color = AppColors.ink,
    this.expand = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final child = Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
        side: BorderSide(color: color),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: sansStyle(
                  size: 13,
                  weight: FontWeight.w600,
                  color: color,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: child) : child;
  }
}
