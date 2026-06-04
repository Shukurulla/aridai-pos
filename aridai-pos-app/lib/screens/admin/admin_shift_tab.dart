import 'package:flutter/material.dart';

import '../../utils/app_colors.dart';
import '../shared/shift_panel.dart';
import 'admin_common.dart';

/// Branch-admin shift control — a thin header over the shared [ShiftPanel]
/// (open/close the active register shift + history of closed shifts). The
/// panel owns the data; the header mirrors its open/closed state.
class AdminShiftTab extends StatefulWidget {
  const AdminShiftTab({super.key});

  @override
  State<AdminShiftTab> createState() => _AdminShiftTabState();
}

class _AdminShiftTabState extends State<AdminShiftTab> {
  final GlobalKey<ShiftPanelState> _panelKey = GlobalKey<ShiftPanelState>();
  bool _shiftOpen = false;
  bool _loading = true;

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
              subtitle: _loading
                  ? 'Загрузка…'
                  : (_shiftOpen ? 'Смена открыта' : 'Смена закрыта'),
              trailing: AdminRefreshButton(
                onTap: () => _panelKey.currentState?.load(),
              ),
            ),
            Expanded(
              child: ShiftPanel(
                key: _panelKey,
                onActiveChanged: (open) {
                  if (!mounted) return;
                  setState(() {
                    _shiftOpen = open;
                    _loading = false;
                  });
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
