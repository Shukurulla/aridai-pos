import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Shared design helpers for the waiter screens — ported 1:1 from the
/// reference app's off-white / red / IBM Plex aesthetic. Read-only screens
/// only use a small subset of the reference kit.

/// IBM Plex Mono — numbers (price, time, ids).
TextStyle numStyle({
  double size = 14,
  FontWeight weight = FontWeight.w500,
  Color color = AppColors.ink,
  double letterSpacing = -0.2,
}) =>
    GoogleFonts.ibmPlexMono(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );

/// IBM Plex Sans — UI text.
TextStyle sansStyle({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = AppColors.ink,
  double letterSpacing = 0,
}) =>
    GoogleFonts.ibmPlexSans(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );

/// Format an amount with space-grouped thousands (e.g. `1 234`).
String fmtNumber(num n) {
  final s = n.round().toString();
  final neg = s.startsWith('-');
  final digits = neg ? s.substring(1) : s;
  final buf = StringBuffer();
  for (int i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write(' ');
    buf.write(digits[i]);
  }
  return '${neg ? '-' : ''}$buf';
}

/// Format money with the tenge sign — `1 234 ₸`.
String fmtMoney(num n) => '${fmtNumber(n)} ₸';

/// "5 мин назад" style relative time.
String formatTimeAgo(DateTime? dateTime) {
  if (dateTime == null) return 'Сейчас';
  final diff = DateTime.now().difference(dateTime);
  if (diff.inSeconds < 60) return 'Сейчас';
  if (diff.inMinutes < 60) return '${diff.inMinutes} мин назад';
  if (diff.inHours < 24) return '${diff.inHours} ч назад';
  return '${diff.inDays} дн назад';
}

/// Logo diamond (rhombus) accent.
class Diamond extends StatelessWidget {
  final double size;
  final Color color;
  const Diamond({super.key, this.size = 8, this.color = AppColors.red});

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: 0.785398, // 45°
      child: Container(width: size, height: size, color: color),
    );
  }
}

/// Section header — small red diamond + uppercased label (+ optional sub).
class SectionHeader extends StatelessWidget {
  final String title;
  final String? sub;
  const SectionHeader({super.key, required this.title, this.sub});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Diamond(size: 5, color: AppColors.red),
              const SizedBox(width: 6),
              Text(
                title.toUpperCase(),
                style: GoogleFonts.ibmPlexSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.mute,
                  letterSpacing: 1.8,
                ),
              ),
            ],
          ),
          if (sub != null) ...[
            const SizedBox(height: 4),
            Text(sub!, style: sansStyle(size: 13, color: AppColors.mute)),
          ],
        ],
      ),
    );
  }
}

/// Pill-shaped filter chip (reference Chip).
class WaiterChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  final int? count;
  final IconData? icon;
  const WaiterChip({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    this.count,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.ink : Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
        side: BorderSide(color: active ? AppColors.ink : AppColors.line2),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon,
                    size: 14, color: active ? Colors.white : AppColors.ink),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: sansStyle(
                  size: 12,
                  weight: FontWeight.w500,
                  color: active ? Colors.white : AppColors.ink,
                  letterSpacing: 0.4,
                ),
              ),
              if (count != null && count! > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: active
                        ? Colors.white.withValues(alpha: 0.18)
                        : AppColors.surface2,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$count',
                    style: numStyle(
                      size: 11,
                      weight: FontWeight.w500,
                      color: active ? Colors.white : AppColors.mute,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Empty / loading-error placeholder used across the tabs.
class WaiterEmpty extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? sub;
  const WaiterEmpty({
    super.key,
    required this.icon,
    required this.title,
    this.sub,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.surface2,
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 24, color: AppColors.mute2),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: sansStyle(
                  size: 14, weight: FontWeight.w500, color: AppColors.ink),
            ),
            if (sub != null) ...[
              const SizedBox(height: 4),
              Text(
                sub!,
                textAlign: TextAlign.center,
                style: sansStyle(size: 12, color: AppColors.mute),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Soft status pill with a leading dot — `[bg] DOT LABEL`.
class StatusChip extends StatelessWidget {
  final String label;
  final Color fg;
  final Color bg;
  const StatusChip({
    super.key,
    required this.label,
    required this.fg,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.ibmPlexSans(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: fg,
              letterSpacing: 0.8,
            ),
          ),
        ],
      ),
    );
  }
}

/// Dark "СТОЛ" + number tile used as an order/table avatar.
class TableBlock extends StatelessWidget {
  final String number;
  final double size;
  final bool accent;
  const TableBlock({
    super.key,
    required this.number,
    this.size = 52,
    this.accent = false,
  });

  @override
  Widget build(BuildContext context) {
    final bg = accent ? AppColors.red : AppColors.ink;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'СТОЛ',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 9,
              letterSpacing: 1,
            ),
          ),
          Text(
            number,
            style: numStyle(
                size: 22, color: Colors.white, weight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
