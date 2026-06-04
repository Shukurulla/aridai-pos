import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_service.dart';
import '../utils/app_colors.dart';

/// Phone-number country presets supported by the login form.
class _Country {
  final String label;
  final String dialCode;
  final int digits;

  const _Country({
    required this.label,
    required this.dialCode,
    required this.digits,
  });
}

const _kz = _Country(label: 'KZ +7', dialCode: '+7', digits: 10);
const _uz = _Country(label: 'UZ +998', dialCode: '+998', digits: 9);
const _countries = [_kz, _uz];

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLoginSuccess});

  final VoidCallback onLoginSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();

  _Country _country = _kz;
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final digits = _phoneController.text.trim();
    final password = _passwordController.text;

    if (digits.length != _country.digits) {
      setState(() {
        _error = 'Введите ${_country.digits}-значный номер';
      });
      return;
    }
    if (password.isEmpty) {
      setState(() => _error = 'Введите пароль');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ApiService.instance.login('${_country.dialCode}$digits', password);
      if (!mounted) return;
      widget.onLoginSuccess();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = _readableError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _readableError(Object e) {
    final text = e.toString();
    return text.startsWith('Exception: ')
        ? text.substring('Exception: '.length)
        : text;
  }

  /// Configure which backend the app talks to — needed on a real device, where
  /// `localhost` is the phone itself (use the dev machine's LAN IP or the
  /// deployed server). Persisted via [ApiService.setServerUrl].
  Future<void> _serverDialog() async {
    final controller = TextEditingController(text: ApiService.baseUrl);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text(
          'Адрес сервера',
          style: TextStyle(
              fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.ink),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Напр.: http://192.168.1.10:4560\n(на устройстве — IP компьютера или сервера)',
              style: TextStyle(fontSize: 12, color: AppColors.mute),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.url,
              autocorrect: false,
              style: const TextStyle(color: AppColors.ink, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.surface2,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.red),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Отмена',
                style: TextStyle(color: AppColors.mute)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Сохранить',
                style: TextStyle(
                    color: AppColors.red, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result == null) return;
    await ApiService.instance.setServerUrl(result);
    if (mounted) setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildBrand(),
                  const SizedBox(height: 40),
                  _buildCard(),
                  const SizedBox(height: 12),
                  _buildServerButton(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBrand() {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.red,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: const Text(
            'A',
            style: TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'AridaiPOS',
          style: TextStyle(
            color: AppColors.ink,
            fontSize: 26,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Вход в систему',
          style: TextStyle(color: AppColors.mute, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _label('Страна'),
          const SizedBox(height: 8),
          _buildCountrySelector(),
          const SizedBox(height: 20),
          _label('Телефон'),
          const SizedBox(height: 8),
          _buildPhoneField(),
          const SizedBox(height: 20),
          _label('Пароль'),
          const SizedBox(height: 8),
          _buildPasswordField(),
          if (_error != null) ...[
            const SizedBox(height: 16),
            _buildError(_error!),
          ],
          const SizedBox(height: 24),
          _buildSubmitButton(),
        ],
      ),
    );
  }

  Widget _label(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.mute,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  Widget _buildCountrySelector() {
    return Row(
      children: _countries.map((c) {
        final selected = c.dialCode == _country.dialCode;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: c == _countries.last ? 0 : 8),
            child: GestureDetector(
              onTap: _loading
                  ? null
                  : () {
                      setState(() {
                        _country = c;
                        _error = null;
                        _phoneController.clear();
                      });
                    },
              child: Container(
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? AppColors.redSoft : AppColors.surface2,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: selected ? AppColors.red : AppColors.line,
                    width: selected ? 1.4 : 1,
                  ),
                ),
                child: Text(
                  c.label,
                  style: TextStyle(
                    color: selected ? AppColors.redInk : AppColors.ink2,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPhoneField() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Text(
              _country.dialCode,
              style: const TextStyle(
                color: AppColors.ink,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Container(width: 1, height: 28, color: AppColors.line),
          Expanded(
            child: TextField(
              controller: _phoneController,
              enabled: !_loading,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(_country.digits),
              ],
              style: const TextStyle(color: AppColors.ink, fontSize: 16),
              decoration: InputDecoration(
                hintText: '0' * _country.digits,
                hintStyle: const TextStyle(color: AppColors.mute2),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordField() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _passwordController,
              enabled: !_loading,
              obscureText: _obscure,
              style: const TextStyle(color: AppColors.ink, fontSize: 16),
              onSubmitted: (_) => _submit(),
              decoration: const InputDecoration(
                hintText: '••••••',
                hintStyle: TextStyle(color: AppColors.mute2),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 14,
                ),
              ),
            ),
          ),
          IconButton(
            onPressed: _loading
                ? null
                : () => setState(() => _obscure = !_obscure),
            icon: Icon(
              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              color: AppColors.mute,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.redSoft,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.red.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.redInk, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.redInk,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServerButton() {
    return TextButton.icon(
      onPressed: _loading ? null : _serverDialog,
      style: TextButton.styleFrom(foregroundColor: AppColors.mute),
      icon: const Icon(Icons.dns_outlined, size: 15, color: AppColors.mute),
      label: Text(
        'Сервер: ${ApiService.baseUrl}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: AppColors.mute, fontSize: 12),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      height: 52,
      child: ElevatedButton(
        onPressed: _loading ? null : _submit,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.red,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.red.withValues(alpha: 0.5),
          disabledForegroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text(
                'ВОЙТИ',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
      ),
    );
  }
}
