import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';

/// Full-order payment flow for the cashier.
///
/// Shows the order summary (items, subtotal/service, big total), a payment
/// method selector (cash / card / transfer / mixed) and a confirm button.
/// For "mixed" three amount inputs must sum to the total exactly before the
/// confirm button enables. On success [onPaid] is invoked (the caller pops &
/// refreshes its list); failures stay on the page with an inline error.
class PaymentPage extends StatefulWidget {
  const PaymentPage({super.key, required this.order, required this.onPaid});

  final OrderModel order;
  final VoidCallback onPaid;

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

/// The four payment methods. Wire names match the backend contract.
enum _Method {
  cash('cash', 'Наличные', Icons.payments_outlined),
  card('card', 'Карта', Icons.credit_card_outlined),
  transfer('transfer', 'Перевод', Icons.account_balance_outlined),
  mixed('mixed', 'Смешанная', Icons.call_split_outlined);

  const _Method(this.wire, this.label, this.icon);
  final String wire;
  final String label;
  final IconData icon;
}

class _PaymentPageState extends State<PaymentPage> {
  final ApiService _api = ApiService.instance;

  _Method _method = _Method.cash;
  bool _busy = false;
  String? _error;

  // Split (mixed) amount inputs.
  final TextEditingController _cashCtrl = TextEditingController();
  final TextEditingController _cardCtrl = TextEditingController();
  final TextEditingController _transferCtrl = TextEditingController();

  @override
  void dispose() {
    _cashCtrl.dispose();
    _cardCtrl.dispose();
    _transferCtrl.dispose();
    super.dispose();
  }

  num get _total => widget.order.totalPrice;

  num _parse(TextEditingController c) =>
      num.tryParse(c.text.trim().replaceAll(' ', '')) ?? 0;

  num get _mixedCash => _parse(_cashCtrl);
  num get _mixedCard => _parse(_cardCtrl);
  num get _mixedTransfer => _parse(_transferCtrl);
  num get _mixedSum => _mixedCash + _mixedCard + _mixedTransfer;

  /// Whether the confirm button may fire. Mixed requires an exact split.
  bool get _canConfirm {
    if (_busy) return false;
    if (_method == _Method.mixed) return _mixedSum == _total;
    return true;
  }

  Future<void> _confirm() async {
    if (!_canConfirm) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_method == _Method.mixed) {
        await _api.payOrder(
          widget.order.id,
          'mixed',
          mixed: {
            'cash': _mixedCash,
            'card': _mixedCard,
            'transfer': _mixedTransfer,
          },
        );
      } else {
        await _api.payOrder(widget.order.id, _method.wire);
      }
      if (!mounted) return;
      _showSnack('Оплата проведена');
      widget.onPaid();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style:
              sansStyle(size: 13, weight: FontWeight.w500, color: Colors.white),
        ),
        backgroundColor: AppColors.ok,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  String get _typeLabel {
    final o = widget.order;
    if (o.isDineIn) {
      if (o.tableNumber != null) return 'Зал · Стол ${o.tableNumber}';
      if (o.tableTitle != null && o.tableTitle!.isNotEmpty) {
        return 'Зал · ${o.tableTitle}';
      }
      return 'Зал';
    }
    switch (o.orderType) {
      case 'takeaway':
        return 'Собой';
      case 'delivery':
        return 'Доставка';
      default:
        return 'Зал';
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final receipt = o.receiptNumber.isEmpty ? '#—' : '#${o.receiptNumber}';
    final hasService = o.subTotal > 0 && o.subTotal != o.totalPrice;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: AppColors.bg,
        iconTheme: const IconThemeData(color: AppColors.ink),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Оплата',
              style: GoogleFonts.ibmPlexSans(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
                letterSpacing: -0.2,
              ),
            ),
            Text(
              '$receipt · $_typeLabel',
              style: sansStyle(size: 11, color: AppColors.mute),
            ),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                children: [
                  const SectionHeader(title: 'Заказ'),
                  _itemsCard(o, hasService),
                  const SizedBox(height: 20),
                  const SectionHeader(title: 'Способ оплаты'),
                  _methodGrid(),
                  if (_method == _Method.mixed) ...[
                    const SizedBox(height: 16),
                    _mixedInputs(),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    _errorBox(_error!),
                  ],
                ],
              ),
            ),
            _bottomBar(),
          ],
        ),
      ),
    );
  }

  // ─── Order summary ───────────────────────────────────────────────────

  Widget _itemsCard(OrderModel o, bool hasService) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (o.items.isEmpty)
            Text(
              'Без позиций',
              style: sansStyle(size: 13, color: AppColors.mute),
            )
          else
            for (int i = 0; i < o.items.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              _itemLine(o.items[i]),
            ],
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.line),
          const SizedBox(height: 12),
          if (hasService) ...[
            _totalsRow('Подытог', o.subTotal, muted: true),
            const SizedBox(height: 8),
            _totalsRow('Обслуживание', o.totalPrice - o.subTotal, muted: true),
            const SizedBox(height: 12),
          ],
          _grandTotal(o.totalPrice),
        ],
      ),
    );
  }

  Widget _itemLine(OrderItem item) {
    final lineSum = item.foodPrice * item.quantity;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.foodName.isEmpty ? 'Без названия' : item.foodName,
                style: sansStyle(
                  size: 14,
                  weight: FontWeight.w500,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${fmtNumber(item.foodPrice)} ₸ × ${item.quantity}',
                style: numStyle(size: 12, color: AppColors.mute),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          fmtMoney(lineSum),
          style: numStyle(
            size: 14,
            weight: FontWeight.w500,
            color: AppColors.ink,
          ),
        ),
      ],
    );
  }

  Widget _totalsRow(String label, num value, {bool muted = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: sansStyle(
            size: 13,
            color: muted ? AppColors.mute : AppColors.ink,
          ),
        ),
        Text(
          fmtMoney(value),
          style: numStyle(
            size: 13,
            weight: FontWeight.w500,
            color: muted ? AppColors.mute : AppColors.ink,
          ),
        ),
      ],
    );
  }

  Widget _grandTotal(num total) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'К ОПЛАТЕ',
            style: GoogleFonts.ibmPlexSans(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.mute,
              letterSpacing: 1.4,
            ),
          ),
          Text(
            fmtMoney(total),
            style: numStyle(
              size: 22,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Method selector ─────────────────────────────────────────────────

  Widget _methodGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _methodCard(_Method.cash)),
            const SizedBox(width: 10),
            Expanded(child: _methodCard(_Method.card)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _methodCard(_Method.transfer)),
            const SizedBox(width: 10),
            Expanded(child: _methodCard(_Method.mixed)),
          ],
        ),
      ],
    );
  }

  Widget _methodCard(_Method m) {
    final active = _method == m;
    return Material(
      color: active ? AppColors.ink : AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: _busy
            ? null
            : () => setState(() {
                  _method = m;
                  _error = null;
                }),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: active ? AppColors.ink : AppColors.line,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
          child: Row(
            children: [
              Icon(
                m.icon,
                size: 20,
                color: active ? Colors.white : AppColors.ink,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  m.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w600,
                    color: active ? Colors.white : AppColors.ink,
                  ),
                ),
              ),
              if (active)
                const Icon(Icons.check_circle, size: 18, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Mixed split inputs ──────────────────────────────────────────────

  Widget _mixedInputs() {
    final entered = _mixedSum;
    final remainder = _total - entered;
    final exact = remainder == 0;
    final over = remainder < 0;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _amountField('Наличные', _cashCtrl),
          const SizedBox(height: 12),
          _amountField('Карта', _cardCtrl),
          const SizedBox(height: 12),
          _amountField('Перевод', _transferCtrl),
          const SizedBox(height: 14),
          const Divider(height: 1, color: AppColors.line),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Введено',
                style: sansStyle(size: 13, color: AppColors.mute),
              ),
              Text(
                '${fmtNumber(entered)} / ${fmtMoney(_total)}',
                style: numStyle(
                  size: 14,
                  weight: FontWeight.w600,
                  color: exact
                      ? AppColors.ok
                      : (over ? AppColors.red : AppColors.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            exact
                ? 'Сумма совпадает'
                : over
                    ? 'Превышение на ${fmtMoney(-remainder)}'
                    : 'Осталось ${fmtMoney(remainder)}',
            style: sansStyle(
              size: 12,
              color: exact
                  ? AppColors.ok
                  : (over ? AppColors.red : AppColors.mute),
            ),
          ),
        ],
      ),
    );
  }

  Widget _amountField(String label, TextEditingController controller) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: sansStyle(
              size: 14,
              weight: FontWeight.w500,
              color: AppColors.ink,
            ),
          ),
        ),
        Expanded(
          child: TextField(
            controller: controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: false),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            textAlign: TextAlign.right,
            style: numStyle(
              size: 15,
              weight: FontWeight.w500,
              color: AppColors.ink,
            ),
            decoration: InputDecoration(
              hintText: '0',
              hintStyle: numStyle(size: 15, color: AppColors.mute2),
              suffixText: ' ₸',
              suffixStyle: sansStyle(size: 13, color: AppColors.mute),
              isDense: true,
              filled: true,
              fillColor: AppColors.surface2,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.ink),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ─── Error + confirm bar ─────────────────────────────────────────────

  Widget _errorBox(String message) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.redSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.red.withValues(alpha: 0.3)),
      ),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 18, color: AppColors.red),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: sansStyle(size: 13, color: AppColors.redInk),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bottomBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      child: _ConfirmButton(
        amount: _total,
        busy: _busy,
        enabled: _canConfirm,
        onTap: _confirm,
      ),
    );
  }
}

/// Big full-width confirm button — shows the total, a spinner while in flight,
/// and dims when disabled (e.g. an incomplete mixed split).
class _ConfirmButton extends StatelessWidget {
  final num amount;
  final bool busy;
  final bool enabled;
  final VoidCallback onTap;
  const _ConfirmButton({
    required this.amount,
    required this.busy,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = enabled && !busy;
    return SizedBox(
      width: double.infinity,
      child: Material(
        color: active ? AppColors.ok : AppColors.ok.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: active ? onTap : null,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (busy) ...[
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Оплата…',
                    style: sansStyle(
                      size: 15,
                      weight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ] else ...[
                  const Icon(Icons.check_rounded, size: 20, color: Colors.white),
                  const SizedBox(width: 10),
                  Text(
                    'Подтвердить оплату',
                    style: sansStyle(
                      size: 15,
                      weight: FontWeight.w600,
                      color: Colors.white,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '· ${fmtMoney(amount)}',
                    style: numStyle(
                      size: 15,
                      weight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
