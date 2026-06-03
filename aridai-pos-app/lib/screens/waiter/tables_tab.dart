import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../models/table_model.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'create_order_screen.dart';
import 'order_detail_screen.dart';

/// Grid of tables/cabins with an occupied/free accent.
///
/// A table counts as occupied when some order has
/// `orderType == dineIn && !isCancel && paymentStatus != "paid"` on that
/// table number. Tapping a FREE table starts a new order on it; tapping an
/// OCCUPIED one opens that table's open order. Live-refreshes on
/// `orders:changed` (pull-to-refresh + a 10s timer remain as fallbacks).
class TablesTab extends StatefulWidget {
  const TablesTab({super.key});

  @override
  State<TablesTab> createState() => TablesTabState();
}

class TablesTabState extends State<TablesTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<TableModel> _tables = const [];
  Set<int> _occupied = const {};

  /// table number -> its open dine-in order (for the occupied-tap → detail).
  Map<int, OrderModel> _openByTable = const {};

  StreamSubscription<void>? _socketSub;
  Timer? _pollTimer;

  /// Reload tables + orders (socket, timer, and parent all use this).
  void reload() => _load();

  @override
  void initState() {
    super.initState();
    _load();
    _socketSub = SocketService.instance.onOrdersChanged.listen((_) {
      if (mounted) _load();
    });
    _pollTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) {
        if (mounted && !_isLoading) _load();
      },
    );
  }

  @override
  void dispose() {
    _socketSub?.cancel();
    _pollTimer?.cancel();
    super.dispose();
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
      final openByTable = <int, OrderModel>{};
      for (final o in orders) {
        if (o.isDineIn &&
            !o.isCancel &&
            o.paymentStatus != 'paid' &&
            o.tableNumber != null) {
          occupied.add(o.tableNumber!);
          // Keep the newest open order for the table.
          final existing = openByTable[o.tableNumber!];
          if (existing == null ||
              (o.createdAt != null &&
                  (existing.createdAt == null ||
                      o.createdAt!.isAfter(existing.createdAt!)))) {
            openByTable[o.tableNumber!] = o;
          }
        }
      }

      tables.sort((a, b) => a.number.compareTo(b.number));

      if (!mounted) return;
      setState(() {
        _tables = tables;
        _occupied = occupied;
        _openByTable = openByTable;
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

  Future<void> _onTapTable(TableModel t) async {
    if (_occupied.contains(t.number)) {
      final order = _openByTable[t.number];
      if (order == null) {
        // Race: marked occupied but no order in hand — just refresh.
        _load();
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => OrderDetailScreen(order: order)),
      );
      if (mounted) _load();
    } else {
      final created = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => CreateOrderScreen(table: t)),
      );
      if (mounted && created == true) _load();
    }
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
            onTap: () => _onTapTable(t),
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
