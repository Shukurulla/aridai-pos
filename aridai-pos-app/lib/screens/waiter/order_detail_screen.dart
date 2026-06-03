import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Read-only order / receipt view. Shows the header (receipt #, type, waiter,
/// time, status), item lines, and the totals block (Подытог / Обслуживание /
/// Итого). Pull-to-refresh re-fetches the order via `GET /orders/<id>`; if that
/// fails the originally passed order is kept. No edit / pay / cooking actions
/// here yet.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.order});

  final OrderModel order;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final ApiService _api = ApiService.instance;

  late OrderModel _order = widget.order;

  Future<void> _refresh() async {
    try {
      final fresh = await _api.getOrder(_order.id);
      if (!mounted) return;
      setState(() => _order = fresh);
    } catch (_) {
      // Keep the passed order on any failure — this is a best-effort refresh.
    }
  }

  ({String label, Color fg, Color bg}) get _status {
    if (_order.isCancel) {
      return (label: 'Отменён', fg: AppColors.red, bg: AppColors.redSoft);
    }
    if (_order.isPaid) {
      return (label: 'Оплачен', fg: AppColors.ok, bg: AppColors.okSoft);
    }
    return (label: 'Открыт', fg: AppColors.warn, bg: AppColors.warnSoft);
  }

  String get _typeLabel {
    switch (_order.orderType) {
      case 'takeaway':
        return 'Собой';
      case 'delivery':
        return 'Доставка';
      default:
        return 'Зал';
    }
  }

  /// "Зал N" / "Собой" / "Доставка" for the header subtitle.
  String get _typeDetail {
    if (_order.isDineIn && _order.tableNumber != null) {
      return 'Зал · Стол ${_order.tableNumber}';
    }
    return _typeLabel;
  }

  String get _receipt {
    final r = _order.receiptNumber;
    return r.isEmpty ? '#—' : '#$r';
  }

  /// Dark tile number: table number for dine-in, else a type letter.
  String get _blockNumber {
    if (_order.tableNumber != null) return '${_order.tableNumber}';
    switch (_order.orderType) {
      case 'takeaway':
        return 'С';
      case 'delivery':
        return 'Д';
      default:
        return '—';
    }
  }

  String _two(int v) => v.toString().padLeft(2, '0');

  String get _hhmm {
    final d = _order.createdAt;
    if (d == null) return '—';
    return '${_two(d.hour)}:${_two(d.minute)}';
  }

  String get _fullDateTime {
    final d = _order.createdAt;
    if (d == null) return '';
    return '${_two(d.day)}.${_two(d.month)}.${d.year}, '
        '${_two(d.hour)}:${_two(d.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _topBar(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                color: AppColors.red,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
                  children: [
                    _statusHeader(),
                    const SizedBox(height: 14),
                    _receiptCard(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Top bar ────────────────────────────────────────────────────────────
  Widget _topBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          _IconBtn(
            icon: Icons.chevron_left,
            onTap: () => Navigator.pop(context),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Заказ $_receipt',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  '$_typeDetail · ${formatTimeAgo(_order.createdAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Status header card ─────────────────────────────────────────────────
  Widget _statusHeader() {
    final st = _status;
    final itemCount = _order.items.fold<int>(0, (s, i) => s + i.quantity);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          TableBlock(number: _blockNumber),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusChip(label: st.label, fg: st.fg, bg: st.bg),
                const SizedBox(height: 6),
                Text(
                  _order.waiterName != null && _order.waiterName!.isNotEmpty
                      ? _order.waiterName!
                      : _typeDetail,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(size: 12, color: AppColors.mute),
                ),
                const SizedBox(height: 4),
                Text(
                  '$itemCount поз.',
                  style: numStyle(size: 11, color: AppColors.mute2),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmtNumber(_order.totalPrice),
                style: numStyle(
                  size: 18,
                  weight: FontWeight.w500,
                  color: AppColors.ink,
                ),
              ),
              Text(
                '₸ ИТОГО',
                style: GoogleFonts.ibmPlexSans(
                  fontSize: 10,
                  color: AppColors.mute,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Receipt card (items + totals) ──────────────────────────────────────
  Widget _receiptCard() {
    final items = _order.items;
    final service = _order.totalPrice - _order.subTotal;
    final hasService = service > 0;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Receipt header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Diamond(size: 5, color: AppColors.red),
                    const SizedBox(width: 6),
                    Text(
                      'ЧЕК $_receipt',
                      style: GoogleFonts.ibmPlexSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.mute,
                        letterSpacing: 1.8,
                      ),
                    ),
                  ],
                ),
                if (_fullDateTime.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    _order.waiterName != null && _order.waiterName!.isNotEmpty
                        ? '$_fullDateTime · официант ${_order.waiterName}'
                        : _fullDateTime,
                    textAlign: TextAlign.center,
                    style: numStyle(size: 10, color: AppColors.mute2),
                  ),
                ],
              ],
            ),
          ),
          const _DashedLine(),
          // Items
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'Нет позиций',
                style: sansStyle(size: 13, color: AppColors.mute),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  for (int i = 0; i < items.length; i++) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 32,
                            child: Text(
                              '×${items[i].quantity}',
                              style: numStyle(
                                size: 13,
                                weight: FontWeight.w500,
                                color: AppColors.ink,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  items[i].foodName,
                                  style: sansStyle(
                                    size: 13,
                                    weight: FontWeight.w500,
                                    color: AppColors.ink,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${fmtNumber(items[i].foodPrice)} × '
                                  '${items[i].quantity}',
                                  style: numStyle(size: 11, color: AppColors.mute),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            fmtNumber(items[i].foodPrice * items[i].quantity),
                            style: numStyle(
                              size: 13,
                              weight: FontWeight.w500,
                              color: AppColors.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (i < items.length - 1)
                      const _DashedLine(color: AppColors.line),
                  ],
                ],
              ),
            ),
          // Totals
          Container(
            width: double.infinity,
            color: AppColors.surface2,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                const _DashedLine(),
                const SizedBox(height: 10),
                _totalRow('Подытог', fmtMoney(_order.subTotal)),
                if (hasService) ...[
                  const SizedBox(height: 8),
                  _totalRow('Обслуживание', fmtMoney(service)),
                ],
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: _DashedLine(),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'ИТОГО',
                      style: GoogleFonts.ibmPlexSans(
                        fontSize: 11,
                        color: AppColors.mute,
                        letterSpacing: 1.6,
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          fmtNumber(_order.totalPrice),
                          style: numStyle(
                            size: 24,
                            weight: FontWeight.w500,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '₸',
                          style: sansStyle(size: 12, color: AppColors.mute),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const _DashedLine(),
          // Footer
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                const Diamond(size: 5, color: AppColors.red),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '$_receipt · $_hhmm',
                    style: numStyle(size: 10, color: AppColors.mute2),
                  ),
                ),
                Text(
                  'aridaiPOS',
                  style: GoogleFonts.ibmPlexSans(
                    fontSize: 10,
                    color: AppColors.mute2,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: sansStyle(size: 12, color: AppColors.mute)),
        Text(value, style: numStyle(size: 12, color: AppColors.mute)),
      ],
    );
  }
}

/// Top-bar icon button (36×36 surface, line2 border, radius 12) — matches the
/// waiter tabs' refresh button.
class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _IconBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.line2),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, size: 20, color: AppColors.ink),
        ),
      ),
    );
  }
}

/// Subtle dashed rule for the receipt (mirrors the reference design).
class _DashedLine extends StatelessWidget {
  final Color color;
  const _DashedLine({this.color = AppColors.line2});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 1,
      width: double.infinity,
      child: CustomPaint(painter: _DashedPainter(color)),
    );
  }
}

class _DashedPainter extends CustomPainter {
  final Color color;
  _DashedPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    const dash = 4.0, gap = 4.0;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    double x = 0;
    while (x < size.width) {
      canvas.drawLine(Offset(x, 0), Offset(x + dash, 0), paint);
      x += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _DashedPainter old) => old.color != color;
}
