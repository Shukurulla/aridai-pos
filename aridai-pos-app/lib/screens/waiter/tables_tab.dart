import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../models/table_model.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Read-only grid of tables/cabins with an occupied/free accent.
///
/// A table counts as occupied when some order has
/// `orderType == dineIn && !isCancel && paymentStatus != "paid"` on that
/// table number. Order creation is a later phase — tapping only hints "Скоро".
class TablesTab extends StatefulWidget {
  const TablesTab({super.key});

  @override
  State<TablesTab> createState() => _TablesTabState();
}

class _TablesTabState extends State<TablesTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<TableModel> _tables = const [];
  Set<int> _occupied = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getTables(),
        _api.getOrders(),
      ]);
      final tables = results[0] as List<TableModel>;
      final orders = results[1] as List<OrderModel>;

      final occupied = <int>{};
      for (final o in orders) {
        if (o.isDineIn &&
            !o.isCancel &&
            o.paymentStatus != 'paid' &&
            o.tableNumber != null) {
          occupied.add(o.tableNumber!);
        }
      }

      tables.sort((a, b) => a.number.compareTo(b.number));

      if (!mounted) return;
      setState(() {
        _tables = tables;
        _occupied = occupied;
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

  void _onTap() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Скоро',
          style: sansStyle(size: 13, weight: FontWeight.w500, color: Colors.white),
        ),
        backgroundColor: AppColors.ink,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _header(),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    final free = _tables.where((t) => !_occupied.contains(t.number)).length;
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Столы',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _isLoading
                      ? 'Загрузка…'
                      : '${_occupied.length} занято · $free свободно',
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          Material(
            color: AppColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.line2),
            ),
            child: InkWell(
              onTap: _isLoading ? null : _load,
              borderRadius: BorderRadius.circular(12),
              child: const SizedBox(
                width: 36,
                height: 36,
                child: Icon(Icons.refresh, size: 18, color: AppColors.ink),
              ),
            ),
          ),
        ],
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
      return RefreshIndicator(
        onRefresh: _load,
        color: AppColors.red,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: WaiterEmpty(
                icon: Icons.error_outline,
                title: 'Не удалось загрузить',
                sub: _error,
              ),
            ),
          ],
        ),
      );
    }
    if (_tables.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        color: AppColors.red,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: const WaiterEmpty(
                icon: Icons.table_restaurant_outlined,
                title: 'Столов пока нет',
                sub: 'Столы появятся здесь',
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.35,
        ),
        itemCount: _tables.length,
        itemBuilder: (context, i) {
          final t = _tables[i];
          return _TableCard(
            table: t,
            occupied: _occupied.contains(t.number),
            onTap: _onTap,
          );
        },
      ),
    );
  }
}

class _TableCard extends StatelessWidget {
  final TableModel table;
  final bool occupied;
  final VoidCallback onTap;
  const _TableCard({
    required this.table,
    required this.occupied,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final accent = occupied ? AppColors.red : AppColors.line;
    final statusFg = occupied ? AppColors.red : AppColors.ok;
    final statusBg = occupied ? AppColors.redSoft : AppColors.okSoft;
    final title = table.title.isNotEmpty
        ? table.title
        : (table.isCabin ? 'Кабина ${table.number}' : 'Стол ${table.number}');

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: accent,
              width: occupied ? 1.5 : 1,
            ),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    '${table.number}',
                    style: numStyle(
                      size: 26,
                      weight: FontWeight.w500,
                      color: occupied ? AppColors.red : AppColors.ink,
                    ),
                  ),
                  const Spacer(),
                  if (table.isCabin)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'кабина',
                        style: GoogleFonts.ibmPlexSans(
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                          color: AppColors.mute,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                ],
              ),
              const Spacer(),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: sansStyle(
                  size: 13,
                  weight: FontWeight.w500,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              StatusChip(
                label: occupied ? 'Занят' : 'Свободно',
                fg: statusFg,
                bg: statusBg,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
