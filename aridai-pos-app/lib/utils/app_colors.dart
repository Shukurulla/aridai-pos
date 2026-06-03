import 'package:flutter/material.dart';

/// aridaiPOS design system — warm off-white surface, black ink, logo-red accent.
/// (Claude Design handoff: #FAFAF7 bg, #0A0A0A ink, #DC2626 red, IBM Plex.)
///
/// Field nomlari eski theme bilan bir xil saqlangan — barcha ekranlar
/// avtomatik yangi (oq/qora/qizil) ko'rinishga o'tadi.
class AppColors {
  // ─── Surface system (warm off-white) ───────────────────────────────
  static const Color bg = Color(0xFFFAFAF7); // page background
  static const Color surface = Color(0xFFFFFFFF); // cards
  static const Color surface2 = Color(0xFFF4F1EA); // subtle fill

  // ─── Ink / text ────────────────────────────────────────────────────
  static const Color ink = Color(0xFF0A0A0A);
  static const Color ink2 = Color(0xFF2A2722);
  static const Color mute = Color(0xFF7A7468);
  static const Color mute2 = Color(0xFFB5AFA2);

  // ─── Lines ─────────────────────────────────────────────────────────
  static const Color line = Color(0xFFECE7DC);
  static const Color line2 = Color(0xFFDDD7C8);

  // ─── Logo-driven red ───────────────────────────────────────────────
  static const Color red = Color(0xFFDC2626);
  static const Color redInk = Color(0xFFB91C1C);
  static const Color redSoft = Color(0xFFFBEDED);

  // ─── Status ────────────────────────────────────────────────────────
  static const Color ok = Color(0xFF1F6F4A);
  static const Color okSoft = Color(0xFFEBF3EE);
  static const Color warn = Color(0xFFB45309);
  static const Color warnSoft = Color(0xFFFAF1E2);
  static const Color infoColor = Color(0xFF1F3F6F);
  static const Color infoSoft = Color(0xFFECEFF5);

  // ─── Backward-compatible aliases (eski ekranlar shularni ishlatadi) ─
  // Aksent endi QIZIL (oldin indigo edi).
  static const Color primary = red;
  static const Color primaryDark = redInk;

  static const Color success = ok;
  static const Color warning = warn;
  static const Color info = infoColor;
  static const Color error = red;

  // Matn: endi QORA fon OQ ustida (oldin teskari edi).
  static const Color textPrimary = ink;
  static const Color textSecondary = mute;
  static const Color textTertiary = mute2;

  // Kartochka endi to'liq OQ; chegara — iliq line.
  static const Color cardBackground = surface;
  static const Color borderColor = line;

  // Eski gradient nomlari — endi iliq off-white (dark navy emas).
  static const Color gradientStart = bg;
  static const Color gradientEnd = surface;

  /// Sahifa foni — endi yumshoq iliq oq (oldin to'q navy gradient edi).
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [bg, bg],
  );

  // ─── Status badge helpers ──────────────────────────────────────────
  static Color getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'preparing':
        return warn;
      case 'ready':
        return ok;
      case 'served':
        return infoColor;
      case 'cancelled':
        return red;
      default:
        return mute;
    }
  }

  static Color getStatusBackgroundColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'preparing':
        return warnSoft;
      case 'ready':
        return okSoft;
      case 'served':
        return infoSoft;
      case 'cancelled':
        return redSoft;
      default:
        return surface2;
    }
  }
}
