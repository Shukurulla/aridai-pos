import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../models/shift.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';

/// Branch-admin shift control — open/close the active register shift and review
/// the history of closed shifts.
class AdminShiftTab extends StatefulWidget {
  const AdminShiftTab({super.key});

  @override
  State<AdminShiftTab> createState() => _AdminShiftTabState();
}

class _AdminShiftTabState extends State<AdminShiftTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  bool _busy = false;
  String? _error;
  List<ShiftModel> _shifts = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final all = await _api.getShifts()
        ..sort((a, b) {
          final ad = a.openedAt;
          final bd = b.openedAt;
          if (ad == null && bd == null) return 0;
          if (ad == null) return 1;
          if (bd == null) return -1;
          return bd.compareTo(ad); // newest first
        });
      if (!mounted) return;
      setState(() {
        _shifts = all;
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

  ShiftModel? get _active {
    for (final s in _shifts) {
      if (s.isActive) return s;
    }
    return null;
  }

  List<ShiftModel> get _closed =>
      _shifts.where((s) => !s.isActive).toList(growable: false);

  Future<void> _openShift() async {
    final amount = await _askAmount(
      title: 'Открыть смену',
      hint: 'Сумма в кассе на начало',
      initial: 0,
    );
    if (amount == null) return;
    setState(() => _busy = true);
    try {
      await _api.openShift(amount);
      await _load();
      if (mounted) showAdminSnack(context, 'Смена открыта');
    } catch (e) {
      if (mounted) {
        showAdminSnack(context, e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _closeShift(ShiftModel shift) async {
    // Default closing cash = opening + cash revenue (when we know it).
    final suggested = shift.openingCash + shift.cashRevenue;
    final amount = await _askAmount(
      title: 'Закрыть смену',
      hint: 'Фактическая сумма в кассе',
      initial: suggested,
    );
    if (amount == null) return;
    setState(() => _busy = true);
    try {
      await _api.closeShift(shift.id, amount);
      await _load();
      if (mounted) showAdminSnack(context, 'Смена закрыта');
    } catch (e) {
      if (mounted) {
        showAdminSnack(context, e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Prompt for a cash amount. Returns the entered number, or null if dismissed.
  Future<num?> _askAmount({
    required String title,
    required String hint,
    required num initial,
  }) async {
    final controller = TextEditingController(
      text: initial == 0 ? '' : fmtNumber(initial).replaceAll(' ', ''),
    );
    final result = await showDialog<num>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          title,
          style: sansStyle(size: 16, weight: FontWeight.w600),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(hint, style: sansStyle(size: 13, color: AppColors.mute)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: numStyle(size: 18, color: AppColors.ink),
              decoration: InputDecoration(
                suffixText: '₸',
                suffixStyle: sansStyle(size: 14, color: AppColors.mute),
                hintText: '0',
                hintStyle: numStyle(size: 18, color: AppColors.mute2),
                filled: true,
                fillColor: AppColors.surface2,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.red),
                ),
              ),
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Отмена',
              style: sansStyle(size: 14, color: AppColors.mute),
            ),
          ),
          AdminButton(
            label: 'Подтвердить',
            onTap: () {
              final value =
                  num.tryParse(controller.text.trim().replaceAll(' ', '')) ?? 0;
              Navigator.of(ctx).pop(value);
            },
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AdminHeader(
              title: 'Смена',
              subtitle: _isLoading
                  ? 'Загрузка…'
                  : (_active != null ? 'Смена открыта' : 'Смена закрыта'),
              trailing: AdminRefreshButton(onTap: _isLoading ? null : _load),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.red),
      );
    }
    if (_error != null) {
      return _refreshable(
        WaiterEmpty(
          icon: Icons.error_outline,
          title: 'Не удалось загрузить',
          sub: _error,
        ),
      );
    }

    final active = _active;
    final closed = _closed;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        children: [
          if (active != null)
            _ActiveCard(
              shift: active,
              busy: _busy,
              onClose: () => _closeShift(active),
            )
          else
            _OpenCard(busy: _busy, onOpen: _openShift),
          const SizedBox(height: 24),
          const SectionHeader(title: 'История', sub: 'Закрытые смены'),
          if (closed.isEmpty)
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.line),
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
              alignment: Alignment.center,
              child: Text(
                'Закрытых смен пока нет',
                style: sansStyle(size: 13, color: AppColors.mute),
              ),
            )
          else
            ...closed.map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _HistoryCard(shift: s),
              ),
            ),
        ],
      ),
    );
  }

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

String _fmtTime(DateTime? dt) {
  if (dt == null) return '—';
  return DateFormat('dd.MM HH:mm').format(dt.toLocal());
}

/// Dark hero card for the currently-open shift + close action.
class _ActiveCard extends StatelessWidget {
  final ShiftModel shift;
  final bool busy;
  final VoidCallback onClose;
  const _ActiveCard({
    required this.shift,
    required this.busy,
    required this.onClose,
  });

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
            right: -12,
            top: -12,
            child: Diamond(
              size: 96,
              color: AppColors.ok.withValues(alpha: 0.18),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const StatusChip(
                      label: 'Открыта',
                      fg: AppColors.ok,
                      bg: AppColors.okSoft,
                    ),
                    const Spacer(),
                    if (shift.shiftNumber != null)
                      Text(
                        'Смена №${shift.shiftNumber}',
                        style: numStyle(
                          size: 12,
                          color: Colors.white.withValues(alpha: 0.7),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  fmtMoney(shift.revenue),
                  style: numStyle(
                    size: 28,
                    weight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Выручка за смену',
                  style: sansStyle(
                    size: 11,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _DarkStat(
                        label: 'Открыта',
                        value: _fmtTime(shift.openedAt),
                      ),
                    ),
                    Expanded(
                      child: _DarkStat(
                        label: 'Касса (старт)',
                        value: fmtMoney(shift.openingCash),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _DarkStat(
                        label: 'Заказов',
                        value: fmtNumber(shift.ordersCount),
                      ),
                    ),
                    Expanded(
                      child: _DarkStat(
                        label: 'Наличными',
                        value: fmtMoney(shift.cashRevenue),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                AdminButton(
                  label: 'Закрыть смену',
                  icon: Icons.lock_outline,
                  color: AppColors.red,
                  busy: busy,
                  expand: true,
                  onTap: onClose,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DarkStat extends StatelessWidget {
  final String label;
  final String value;
  const _DarkStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.ibmPlexSans(
            fontSize: 9,
            fontWeight: FontWeight.w500,
            color: Colors.white.withValues(alpha: 0.5),
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: numStyle(
            size: 14,
            weight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}

/// Card shown when no shift is open — a single "Открыть смену" call to action.
class _OpenCard extends StatelessWidget {
  final bool busy;
  final VoidCallback onOpen;
  const _OpenCard({required this.busy, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(18),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.surface2,
              border: Border.all(color: AppColors.line),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.point_of_sale_outlined,
              size: 26,
              color: AppColors.mute,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Смена не открыта',
            style: sansStyle(
              size: 15,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Откройте смену, чтобы начать приём заказов',
            textAlign: TextAlign.center,
            style: sansStyle(size: 12, color: AppColors.mute),
          ),
          const SizedBox(height: 18),
          AdminButton(
            label: 'Открыть смену',
            icon: Icons.lock_open_outlined,
            busy: busy,
            expand: true,
            onTap: onOpen,
          ),
        ],
      ),
    );
  }
}

/// One closed shift in the history list.
class _HistoryCard extends StatelessWidget {
  final ShiftModel shift;
  const _HistoryCard({required this.shift});

  @override
  Widget build(BuildContext context) {
    final disc = shift.closingDiscrepancy;
    final bool hasDisc = disc != null && disc != 0;

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
          Row(
            children: [
              Text(
                shift.shiftNumber != null
                    ? 'Смена №${shift.shiftNumber}'
                    : 'Смена',
                style: sansStyle(
                  size: 14,
                  weight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
              const Spacer(),
              Text(
                fmtMoney(shift.revenue),
                style: numStyle(
                  size: 15,
                  weight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.schedule, size: 12, color: AppColors.mute),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  '${_fmtTime(shift.openedAt)} → ${_fmtTime(shift.closedAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: numStyle(size: 11, color: AppColors.mute),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _Pill(
                label: '${fmtNumber(shift.ordersCount)} заказов',
              ),
              if (hasDisc)
                _Pill(
                  label: 'Расхожд. ${fmtMoney(disc)}',
                  danger: true,
                )
              else
                const _Pill(label: 'Касса сошлась', ok: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final bool danger;
  final bool ok;
  const _Pill({required this.label, this.danger = false, this.ok = false});

  @override
  Widget build(BuildContext context) {
    final Color bg = danger
        ? AppColors.redSoft
        : ok
            ? AppColors.okSoft
            : AppColors.surface2;
    final Color fg = danger
        ? AppColors.red
        : ok
            ? AppColors.ok
            : AppColors.mute;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: sansStyle(size: 11, weight: FontWeight.w500, color: fg),
      ),
    );
  }
}
