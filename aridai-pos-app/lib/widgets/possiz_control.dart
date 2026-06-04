import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../services/branch_status_service.dart';
import '../utils/app_colors.dart';
import '../utils/waiter_design.dart';

/// Admin control card to toggle possiz (emergency) mode for the branch — used
/// when the power is out and the POS is down. Turning it on lets waiters order
/// from their phones (via the global backend) and makes cooks receive FCM
/// notifications. Reads/writes through [BranchStatusService] + the API.
class PossizControl extends StatefulWidget {
  const PossizControl({super.key});

  @override
  State<PossizControl> createState() => _PossizControlState();
}

class _PossizControlState extends State<PossizControl> {
  bool _busy = false;

  Future<void> _toggle(bool next) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final result = await ApiService.instance.setPossiz(next);
      BranchStatusService.instance.setPossizLocal(result);
      await BranchStatusService.instance.refresh();
      if (mounted) {
        _snack(result ? 'Режим ПОССИЗ включён' : 'Режим ПОССИЗ выключен');
      }
    } catch (e) {
      if (mounted) _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String m) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(m,
            style:
                sansStyle(size: 13, weight: FontWeight.w500, color: Colors.white)),
        backgroundColor: AppColors.ink,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: BranchStatusService.instance.possiz,
      builder: (context, active, _) {
        return Container(
          margin: const EdgeInsets.fromLTRB(20, 14, 20, 0),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: active ? AppColors.redSoft : AppColors.surface,
            border: Border.all(
              color: active
                  ? AppColors.red.withValues(alpha: 0.4)
                  : AppColors.line,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: active ? AppColors.red : AppColors.surface2,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(Icons.bolt_rounded,
                    size: 22, color: active ? Colors.white : AppColors.mute),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Режим ПОССИЗ',
                        style: sansStyle(size: 15, weight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(
                      active
                          ? 'Включён — заказы через телефон, повара получают уведомления'
                          : 'Включите при отключении света (POS не работает)',
                      style: sansStyle(size: 11, color: AppColors.mute),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _busy
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(AppColors.red),
                      ),
                    )
                  : Switch(
                      value: active,
                      activeThumbColor: AppColors.red,
                      onChanged: _toggle,
                    ),
            ],
          ),
        );
      },
    );
  }
}
