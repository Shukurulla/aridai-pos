import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Read-only waiter profile + salary card + logout.
class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  String _initials() {
    final parts =
        user.name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    final letters = parts.take(2).map((p) => p[0].toUpperCase()).join();
    return letters.isEmpty ? '?' : letters;
  }

  /// Short "rate" stat for the user card (mirrors the reference's Ставка stat).
  String _rateLabel(SalaryInfo? s) {
    if (s == null) return '—';
    switch (s.mode) {
      case 'daily':
        return fmtMoney(s.amount);
      case 'monthly':
        return fmtMoney(s.amount);
      case 'percent':
        return '${fmtNumber(s.amount)}%';
      default:
        return '—';
    }
  }

  /// Prefer the freshest user (session may have been refreshed).
  User get _user => ApiService.instance.currentUser ?? user;

  @override
  Widget build(BuildContext context) {
    final u = _user;
    final place = u.branchName ?? u.restaurantName ?? 'Филиал';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top bar
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(
                  'Профиль',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
              ),

              // Dark user card
              _UserCard(
                initials: _initials(),
                fullName: u.name.isEmpty ? 'Пользователь' : u.name,
                roleLabel: 'Официант',
                place: place,
                phone: u.phone,
                rate: _rateLabel(u.salary),
              ),

              const SizedBox(height: 20),

              // Salary
              const SectionHeader(
                title: 'Зарплата',
                sub: 'Условия оплаты',
              ),
              _SalaryCard(salary: u.salary),

              const SizedBox(height: 20),

              // Branch
              const SectionHeader(
                title: 'Заведение',
                sub: 'Место работы',
              ),
              _InfoCard(
                icon: Icons.storefront_outlined,
                title: place,
                subtitle: u.restaurantName != null &&
                        u.restaurantName!.isNotEmpty &&
                        u.restaurantName != place
                    ? u.restaurantName!
                    : null,
              ),

              const SizedBox(height: 24),

              // Logout
              _LogoutButton(onLogout: onLogout),

              const SizedBox(height: 16),
              Center(
                child: Text(
                  'ARIDAIPOS · 2.0.0',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: AppColors.mute2,
                    letterSpacing: 1.6,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  final String initials;
  final String fullName;
  final String roleLabel;
  final String place;
  final String phone;
  final String rate;

  const _UserCard({
    required this.initials,
    required this.fullName,
    required this.roleLabel,
    required this.place,
    required this.phone,
    required this.rate,
  });

  Widget _stat(String label, Widget value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.ibmPlexSans(
              fontSize: 9,
              color: Colors.white.withValues(alpha: 0.5),
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 3),
          value,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(18),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -20,
            top: -20,
            child: Diamond(
              size: 90,
              color: AppColors.red.withValues(alpha: 0.15),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: const BoxDecoration(
                        color: AppColors.red,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initials,
                        style: GoogleFonts.ibmPlexSans(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.ibmPlexSans(
                              fontSize: 17,
                              fontWeight: FontWeight.w500,
                              color: Colors.white,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$roleLabel · $place',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.ibmPlexSans(
                              fontSize: 11,
                              color: Colors.white.withValues(alpha: 0.6),
                              letterSpacing: 0.4,
                            ),
                          ),
                          if (phone.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Diamond(size: 5, color: AppColors.red),
                                const SizedBox(width: 6),
                                Text(
                                  phone,
                                  style: numStyle(
                                    size: 11,
                                    color: Colors.white.withValues(alpha: 0.8),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.1),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _stat(
                      'Ставка',
                      Text(
                        rate,
                        style: numStyle(
                          size: 16,
                          weight: FontWeight.w500,
                          color: AppColors.red,
                        ),
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 30,
                      color: Colors.white.withValues(alpha: 0.1),
                    ),
                    const SizedBox(width: 14),
                    _stat(
                      'Заведение',
                      Text(
                        place,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.ibmPlexSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SalaryCard extends StatelessWidget {
  final SalaryInfo? salary;
  const _SalaryCard({this.salary});

  /// (line, accent?) describing the salary configuration.
  ({String text, bool accent}) get _display {
    final s = salary;
    if (s == null) return (text: 'Зарплата не настроена', accent: false);
    switch (s.mode) {
      case 'daily':
        return (text: 'Дневная: ${fmtMoney(s.amount)}', accent: true);
      case 'monthly':
        return (text: 'Месячная: ${fmtMoney(s.amount)}', accent: true);
      case 'percent':
        return (text: 'С заказов: ${fmtNumber(s.amount)}%', accent: true);
      default:
        return (text: 'Зарплата не настроена', accent: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _display;
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: d.accent ? AppColors.redSoft : AppColors.surface2,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.account_balance_wallet_outlined,
              color: d.accent ? AppColors.red : AppColors.mute,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Оплата труда',
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
                const SizedBox(height: 3),
                Text(
                  d.text,
                  style: sansStyle(
                    size: 15,
                    weight: FontWeight.w500,
                    color: d.accent ? AppColors.ink : AppColors.mute,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  const _InfoCard({required this.icon, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.ink, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: AppColors.ink,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
                    style: sansStyle(size: 11, color: AppColors.mute),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  final VoidCallback onLogout;
  const _LogoutButton({required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: const BorderSide(color: AppColors.red),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onLogout,
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.logout, size: 18, color: AppColors.red),
                const SizedBox(width: 8),
                Text(
                  'Выйти',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.red,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
