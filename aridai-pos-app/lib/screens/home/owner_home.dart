import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/owner_stats.dart';
import '../../models/user.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Owner overview — a read-only revenue-analytics dashboard aggregated across
/// every branch of the owner's restaurant. Period filter (today / 7d / 30d /
/// year) drives stat cards, a per-branch comparison, a payment-method split,
/// the best-selling dishes and a compact revenue timeline.
class OwnerHome extends StatefulWidget {
  const OwnerHome({super.key, required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  State<OwnerHome> createState() => _OwnerHomeState();
}

/// Period filter values map 1:1 to the backend `period` query param.
enum _Period {
  today('today', 'Сегодня'),
  week('7d', '7 дней'),
  month('30d', '30 дней'),
  year('year', 'Год');

  const _Period(this.api, this.label);
  final String api;
  final String label;
}

class _OwnerHomeState extends State<OwnerHome> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  OwnerStats? _stats;
  _Period _period = _Period.week; // default 7d

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final stats = await _api.getOwnerStats(_period.api);
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _isLoading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _selectPeriod(_Period p) {
    if (p == _period) return;
    setState(() => _period = p);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          _Header(
            user: widget.user,
            onLogout: widget.onLogout,
            onRefresh: _isLoading ? null : _load,
          ),
          _periodBar(),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _periodBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (int i = 0; i < _Period.values.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              WaiterChip(
                label: _Period.values[i].label,
                active: _period == _Period.values[i],
                onTap: () => _selectPeriod(_Period.values[i]),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_isLoading && _stats == null) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.red),
      );
    }
    if (_error != null && _stats == null) {
      return _refreshable(
        WaiterEmpty(
          icon: Icons.error_outline,
          title: 'Не удалось загрузить',
          sub: _error,
        ),
      );
    }

    final s = _stats ?? const OwnerStats();

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        children: [
          if (_error != null) ...[
            _ErrorBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          _statCards(s),
          if (s.isEmpty) ...[
            const SizedBox(height: 28),
            const WaiterEmpty(
              icon: Icons.insights_outlined,
              title: 'Нет продаж за период',
              sub: 'Выберите другой период или обновите',
            ),
          ] else ...[
            if (s.byBranch.isNotEmpty) ...[
              const SizedBox(height: 24),
              const SectionHeader(
                title: 'Филиалы',
                sub: 'Выручка по филиалам',
              ),
              _branchList(s.byBranch),
            ],
            ..._paymentSection(s.byMethod),
            if (s.topFoods.isNotEmpty) ...[
              const SizedBox(height: 24),
              const SectionHeader(
                title: 'ТОП блюд',
                sub: 'По количеству продаж',
              ),
              _topFoods(s.topFoods),
            ],
            if (_dailyHasRevenue(s.daily)) ...[
              const SizedBox(height: 24),
              const SectionHeader(title: 'Динамика', sub: 'Выручка по дням'),
              _DailyBars(points: s.daily),
            ],
          ],
        ],
      ),
    );
  }

  // ─── Stat cards (2×2) ──────────────────────────────────────────────

  Widget _statCards(OwnerStats s) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Выручка',
                value: fmtMoney(s.revenue),
                icon: Icons.payments_outlined,
                accent: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _StatCard(
                label: 'Заказов',
                value: fmtNumber(s.ordersCount),
                icon: Icons.receipt_long_outlined,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Средний чек',
                value: fmtMoney(s.avgCheck),
                icon: Icons.trending_up_rounded,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _StatCard(
                label: 'Отменено',
                value: fmtNumber(s.cancelledCount),
                icon: Icons.cancel_outlined,
                danger: s.cancelledCount > 0,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── Branch comparison ─────────────────────────────────────────────

  Widget _branchList(List<BranchStat> branches) {
    final maxRevenue = branches.fold<int>(
      0,
      (m, b) => b.revenue > m ? b.revenue : m,
    );
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (int i = 0; i < branches.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.line),
            _BranchRow(branch: branches[i], maxRevenue: maxRevenue),
          ],
        ],
      ),
    );
  }

  // ─── Payment-method split ──────────────────────────────────────────

  List<Widget> _paymentSection(PaymentBreakdown m) {
    final rows = <({String label, int amount})>[
      (label: 'Наличные', amount: m.cash),
      (label: 'Карта', amount: m.card),
      (label: 'Перевод', amount: m.transfer),
      (label: 'Kaspi', amount: m.kaspi),
      if (m.mixed > 0) (label: 'Смешанная', amount: m.mixed),
    ];
    final visible = rows.where((r) => r.amount > 0).toList(growable: false);
    if (visible.isEmpty) return const [];

    return [
      const SizedBox(height: 24),
      const SectionHeader(
        title: 'Оплата по способам',
        sub: 'Распределение выручки',
      ),
      Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(14),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            for (int i = 0; i < visible.length; i++) ...[
              if (i > 0) const Divider(height: 1, color: AppColors.line),
              _MethodRow(label: visible[i].label, amount: visible[i].amount),
            ],
          ],
        ),
      ),
    ];
  }

  // ─── Top dishes ────────────────────────────────────────────────────

  Widget _topFoods(List<TopFood> foods) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (int i = 0; i < foods.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.line),
            _FoodRow(rank: i + 1, food: foods[i]),
          ],
        ],
      ),
    );
  }

  bool _dailyHasRevenue(List<DailyPoint> daily) =>
      daily.any((d) => d.revenue > 0);

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: child,
          ),
        ],
      ),
    );
  }
}

/// Dark top header — restaurant/owner name + manual refresh + logout.
class _Header extends StatelessWidget {
  final User user;
  final VoidCallback onLogout;
  final VoidCallback? onRefresh;
  const _Header({
    required this.user,
    required this.onLogout,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final u = ApiService.instance.currentUser ?? user;
    final place = u.restaurantName ?? u.branchName ?? 'Обзор';
    final name = u.name.isEmpty ? 'Владелец' : u.name;

    return Container(
      decoration: const BoxDecoration(color: AppColors.ink),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 4, 10),
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
                      '$name · Владелец',
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
                tooltip: 'Обновить',
                onPressed: onRefresh,
                icon: Icon(
                  Icons.refresh,
                  size: 20,
                  color: Colors.white.withValues(alpha: 0.85),
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

/// Inline (non-fatal) error banner shown above stale data after a failed
/// reload.
class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.redSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          const Icon(Icons.error_outline, size: 18, color: AppColors.red),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: sansStyle(size: 12, color: AppColors.redInk),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool accent;
  final bool danger;
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.accent = false,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final Color iconBg = danger
        ? AppColors.redSoft
        : accent
            ? AppColors.okSoft
            : AppColors.surface2;
    final Color iconFg = danger
        ? AppColors.red
        : accent
            ? AppColors.ok
            : AppColors.mute;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconFg, size: 18),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: numStyle(
              size: 18,
              weight: FontWeight.w600,
              color: accent ? AppColors.ok : AppColors.ink,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: sansStyle(size: 11, color: AppColors.mute)),
        ],
      ),
    );
  }
}

/// One branch row: name, order count, bold revenue, and a thin red proportion
/// bar (this branch's revenue ÷ the top branch's revenue).
class _BranchRow extends StatelessWidget {
  final BranchStat branch;
  final int maxRevenue;
  const _BranchRow({required this.branch, required this.maxRevenue});

  @override
  Widget build(BuildContext context) {
    final double fraction =
        maxRevenue <= 0 ? 0 : (branch.revenue / maxRevenue).clamp(0.0, 1.0);
    final name = branch.branchName.isEmpty ? 'Филиал' : branch.branchName;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: AppColors.ink,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                fmtMoney(branch.revenue),
                style: numStyle(
                  size: 14,
                  weight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Stack(
                    children: [
                      Container(height: 5, color: AppColors.surface2),
                      FractionallySizedBox(
                        widthFactor: fraction == 0 ? 0.02 : fraction,
                        child: Container(height: 5, color: AppColors.red),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '${fmtNumber(branch.ordersCount)} зак.',
                style: numStyle(size: 11, color: AppColors.mute),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A payment-method row: label on the left, amount (₸) on the right.
class _MethodRow extends StatelessWidget {
  final String label;
  final int amount;
  const _MethodRow({required this.label, required this.amount});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: sansStyle(
                size: 14,
                weight: FontWeight.w500,
                color: AppColors.ink,
              ),
            ),
          ),
          Text(
            fmtMoney(amount),
            style: numStyle(
              size: 14,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

/// A best-selling dish row — rank badge, name + revenue, quantity pill.
class _FoodRow extends StatelessWidget {
  final int rank;
  final TopFood food;
  const _FoodRow({required this.rank, required this.food});

  @override
  Widget build(BuildContext context) {
    final name = food.name.isEmpty ? 'Без названия' : food.name;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: rank == 1 ? AppColors.ink : AppColors.surface2,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$rank',
              style: numStyle(
                size: 12,
                weight: FontWeight.w600,
                color: rank == 1 ? Colors.white : AppColors.mute,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fmtMoney(food.sum),
                  style: numStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '× ${food.qty}',
              style: numStyle(
                size: 13,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact revenue timeline — vertical bars (last ~14 days) sized by revenue.
/// No chart package: just sized Containers in a card.
class _DailyBars extends StatelessWidget {
  final List<DailyPoint> points;
  const _DailyBars({required this.points});

  @override
  Widget build(BuildContext context) {
    final recent = points.length > 14
        ? points.sublist(points.length - 14)
        : points;
    final maxRevenue = recent.fold<int>(
      0,
      (m, p) => p.revenue > m ? p.revenue : m,
    );

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 88,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final p in recent)
                  Expanded(
                    child: _Bar(
                      fraction: maxRevenue <= 0
                          ? 0
                          : (p.revenue / maxRevenue).clamp(0.0, 1.0),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _shortDate(recent.first.date),
                style: numStyle(size: 10, color: AppColors.mute),
              ),
              Text(
                _shortDate(recent.last.date),
                style: numStyle(size: 10, color: AppColors.mute),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// `2026-06-02` → `02.06`.
  static String _shortDate(String iso) {
    final parts = iso.split('-');
    if (parts.length == 3) return '${parts[2]}.${parts[1]}';
    return iso;
  }
}

class _Bar extends StatelessWidget {
  final double fraction;
  const _Bar({required this.fraction});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Align(
        alignment: Alignment.bottomCenter,
        child: FractionallySizedBox(
          heightFactor: fraction <= 0 ? 0.02 : fraction,
          child: Container(
            decoration: BoxDecoration(
              color: fraction <= 0 ? AppColors.surface2 : AppColors.red,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        ),
      ),
    );
  }
}
