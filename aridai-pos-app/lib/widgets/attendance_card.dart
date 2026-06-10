import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/waiter_design.dart';

/// KELDI-KETTI — "Keldim/Ketdim" kartasi (obsidian/04-toollar/keldi-ketti.md).
/// Modul o'chiq bo'lsa (404 FEATURE_DISABLED) karta umuman ko'rinmaydi.
/// Holatlar: belgilanmagan → "Я ПРИШЁЛ"; kelgan → vaqt + "Я УШЁЛ"; ketgan → yakun.
class AttendanceCard extends StatefulWidget {
  const AttendanceCard({super.key});

  @override
  State<AttendanceCard> createState() => _AttendanceCardState();
}

class _AttendanceCardState extends State<AttendanceCard> {
  bool _hidden = false; // modul o'chiq / xato — kartani yashiramiz
  bool _loading = true;
  bool _busy = false;
  Map<String, dynamic> _att = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await ApiService.instance.kkToday();
      if (!mounted) return;
      setState(() {
        _att = d;
        _loading = false;
      });
    } catch (_) {
      // FEATURE_DISABLED yoki tarmoq — profil buzilmasin, karta yashirin
      if (mounted) setState(() => _hidden = true);
    }
  }

  Future<void> _act(Future<Map<String, dynamic>> Function() fn) async {
    setState(() => _busy = true);
    try {
      final d = await fn();
      if (!mounted) return;
      setState(() => _att = d);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst('Exception: ', ''),
            style: sansStyle(size: 13, weight: FontWeight.w500, color: Colors.white),
          ),
          backgroundColor: AppColors.warn,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _hm(String? iso) {
    if (iso == null) return '—';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '—';
    return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_hidden) return const SizedBox.shrink();

    final arrived = _att['arrivedAt'] != null;
    final left = _att['leftAt'] != null;
    final isLate = _att['isLate'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: _loading
          ? const SizedBox(
              height: 44,
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            )
          : Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Рабочий день',
                          style: sansStyle(size: 12, weight: FontWeight.w600, color: AppColors.mute)),
                      const SizedBox(height: 4),
                      Text(
                        !arrived
                            ? 'Не отмечен'
                            : left
                                ? 'Пришёл ${_hm(_att['arrivedAt'])} · Ушёл ${_hm(_att['leftAt'])}'
                                : 'Пришёл в ${_hm(_att['arrivedAt'])}${isLate ? ' · опоздание ${_att['lateMinutes']} мин' : ''}',
                        style: sansStyle(
                          size: 14,
                          weight: FontWeight.w600,
                          color: isLate ? AppColors.warn : AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!left)
                  SizedBox(
                    height: 44,
                    child: ElevatedButton(
                      onPressed: _busy
                          ? null
                          : () => _act(arrived
                              ? ApiService.instance.kkCheckOut
                              : ApiService.instance.kkCheckIn),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: arrived ? AppColors.mute : AppColors.red,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                      ),
                      child: Text(
                        _busy ? '…' : (arrived ? 'Я УШЁЛ' : 'Я ПРИШЁЛ'),
                        style: sansStyle(size: 13, weight: FontWeight.w700, color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
