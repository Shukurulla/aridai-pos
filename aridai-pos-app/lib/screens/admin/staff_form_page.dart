import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/category.dart';
import '../../models/food.dart';
import '../../models/staff.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';

/// Phone-number country presets (mirrors the login screen).
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

/// Roles the admin can create / assign.
const _roles = ['waiter', 'cook', 'cashier'];

/// Salary modes for waiters.
const _salaryModes = ['none', 'daily', 'monthly', 'percent'];

/// Full-screen add/edit staff form.
///
/// Add mode: requires name + phone + password + role. Edit mode ([editing] set)
/// prefills everything and lets the admin change role/salary/assignments/
/// isActive, with password optional (only sent when typed).
class StaffFormPage extends StatefulWidget {
  const StaffFormPage({super.key, this.editing});

  final StaffMember? editing;

  @override
  State<StaffFormPage> createState() => _StaffFormPageState();
}

class _StaffFormPageState extends State<StaffFormPage> {
  final ApiService _api = ApiService.instance;

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _salaryController = TextEditingController();

  _Country _country = _kz;
  String _role = 'waiter';
  bool _isActive = true;
  String _salaryMode = 'none';
  bool _obscure = true;
  bool _saving = false;
  String? _error;

  // Cook food-assignment data.
  bool _menuLoading = false;
  String? _menuError;
  List<Category> _categories = const [];
  List<Food> _foods = const [];
  final Set<String> _selectedCategories = <String>{};
  final Set<String> _selectedFoods = <String>{};

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.editing;
    if (e != null) {
      _nameController.text = e.name;
      _role = _roles.contains(e.role) ? e.role : 'waiter';
      _isActive = e.isActive;
      _salaryMode = _salaryModes.contains(e.salaryMode) ? e.salaryMode : 'none';
      if (e.salaryAmount > 0) {
        _salaryController.text =
            fmtNumber(e.salaryAmount).replaceAll(' ', '');
      }
      _selectedCategories.addAll(e.assignedCategories);
      _selectedFoods.addAll(e.assignedFoods);
      // Derive phone country + local digits from the stored phone.
      _hydratePhone(e.phone);
    }
    if (_role == 'cook') _loadMenu();
  }

  void _hydratePhone(String phone) {
    for (final c in _countries) {
      if (phone.startsWith(c.dialCode)) {
        _country = c;
        _phoneController.text = phone.substring(c.dialCode.length);
        return;
      }
    }
    // Unknown prefix — keep raw digits.
    _phoneController.text = phone.replaceAll(RegExp(r'\D'), '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _salaryController.dispose();
    super.dispose();
  }

  Future<void> _loadMenu() async {
    if (_categories.isNotEmpty || _foods.isNotEmpty) return; // cached
    setState(() {
      _menuLoading = true;
      _menuError = null;
    });
    try {
      final results = await Future.wait([
        _api.getCategories(),
        _api.getFoods(),
      ]);
      if (!mounted) return;
      setState(() {
        _categories = results[0] as List<Category>;
        _foods = results[1] as List<Food>;
        _menuLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _menuLoading = false;
        _menuError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _onRoleChanged(String role) {
    setState(() => _role = role);
    if (role == 'cook') _loadMenu();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final name = _nameController.text.trim();
    final digits = _phoneController.text.trim();
    final password = _passwordController.text;

    if (name.isEmpty) {
      setState(() => _error = 'Введите имя');
      return;
    }
    if (digits.length != _country.digits) {
      setState(
          () => _error = 'Введите ${_country.digits}-значный номер телефона');
      return;
    }
    if (!_isEdit && password.isEmpty) {
      setState(() => _error = 'Введите пароль');
      return;
    }

    final num salaryAmount =
        num.tryParse(_salaryController.text.trim().replaceAll(' ', '')) ?? 0;

    final body = <String, dynamic>{
      'name': name,
      'role': _role,
    };

    // Salary only applies to waiters; other roles get "none".
    if (_role == 'waiter') {
      body['salaryMode'] = _salaryMode;
      body['salaryAmount'] = _salaryMode == 'none' ? 0 : salaryAmount;
    } else {
      body['salaryMode'] = 'none';
      body['salaryAmount'] = 0;
    }

    // Food assignment only applies to cooks.
    if (_role == 'cook') {
      body['assignedCategories'] = _selectedCategories.toList();
      body['assignedFoods'] = _selectedFoods.toList();
    } else {
      body['assignedCategories'] = <String>[];
      body['assignedFoods'] = <String>[];
    }

    if (password.isNotEmpty) body['password'] = password;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      if (_isEdit) {
        body['isActive'] = _isActive;
        await _api.updateStaff(widget.editing!.id, body);
      } else {
        body['phone'] = '${_country.dialCode}$digits';
        await _api.createStaff(body);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.ink),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          _isEdit ? 'Редактировать' : 'Новый сотрудник',
          style: GoogleFonts.ibmPlexSans(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  _label('Имя'),
                  const SizedBox(height: 8),
                  _textField(
                    controller: _nameController,
                    hint: 'Имя сотрудника',
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 20),
                  _label(_isEdit ? 'Телефон (нельзя изменить)' : 'Телефон'),
                  const SizedBox(height: 8),
                  _phoneRow(),
                  const SizedBox(height: 20),
                  _label(_isEdit ? 'Новый пароль (необязательно)' : 'Пароль'),
                  const SizedBox(height: 8),
                  _passwordField(),
                  const SizedBox(height: 20),
                  _label('Роль'),
                  const SizedBox(height: 8),
                  _roleSelector(),
                  if (_isEdit) ...[
                    const SizedBox(height: 20),
                    _activeToggle(),
                  ],
                  if (_role == 'waiter') ...[
                    const SizedBox(height: 24),
                    const SectionHeader(
                        title: 'Зарплата', sub: 'Условия оплаты'),
                    _salarySection(),
                  ],
                  if (_role == 'cook') ...[
                    const SizedBox(height: 24),
                    const SectionHeader(
                      title: 'Доступ к блюдам',
                      sub: 'Пусто = повар видит все блюда',
                    ),
                    _foodSection(),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 18),
                    _errorBox(_error!),
                  ],
                ],
              ),
            ),
            _footer(),
          ],
        ),
      ),
    );
  }

  Widget _footer() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      child: SafeArea(
        top: false,
        child: AdminButton(
          label: _isEdit ? 'Сохранить' : 'Добавить сотрудника',
          icon: _isEdit ? Icons.check_rounded : Icons.person_add_alt_1,
          busy: _saving,
          expand: true,
          onTap: _submit,
        ),
      ),
    );
  }

  // ─── Field helpers ─────────────────────────────────────────────────

  Widget _label(String text) {
    return Text(
      text,
      style: sansStyle(size: 12, weight: FontWeight.w600, color: AppColors.mute),
    );
  }

  Widget _textField({
    required TextEditingController controller,
    required String hint,
    bool enabled = true,
    TextInputType? keyboardType,
    List<TextInputFormatter>? formatters,
  }) {
    return TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      inputFormatters: formatters,
      style: sansStyle(size: 15, color: AppColors.ink),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: sansStyle(size: 15, color: AppColors.mute2),
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
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      ),
    );
  }

  Widget _phoneRow() {
    return Row(
      children: [
        // Country selector (disabled in edit mode — phone is immutable).
        for (final c in _countries) ...[
          GestureDetector(
            onTap: (_saving || _isEdit)
                ? null
                : () => setState(() {
                      _country = c;
                      _phoneController.clear();
                      _error = null;
                    }),
            child: Container(
              height: 50,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: c.dialCode == _country.dialCode
                    ? AppColors.redSoft
                    : AppColors.surface2,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: c.dialCode == _country.dialCode
                      ? AppColors.red
                      : AppColors.line,
                ),
              ),
              child: Text(
                c.label,
                style: sansStyle(
                  size: 12,
                  weight: FontWeight.w600,
                  color: c.dialCode == _country.dialCode
                      ? AppColors.redInk
                      : AppColors.ink2,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: _textField(
            controller: _phoneController,
            hint: '0' * _country.digits,
            enabled: !_saving && !_isEdit,
            keyboardType: TextInputType.number,
            formatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(_country.digits),
            ],
          ),
        ),
      ],
    );
  }

  Widget _passwordField() {
    return TextField(
      controller: _passwordController,
      enabled: !_saving,
      obscureText: _obscure,
      style: sansStyle(size: 15, color: AppColors.ink),
      decoration: InputDecoration(
        hintText: '••••••',
        hintStyle: sansStyle(size: 15, color: AppColors.mute2),
        filled: true,
        fillColor: AppColors.surface2,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        suffixIcon: IconButton(
          onPressed:
              _saving ? null : () => setState(() => _obscure = !_obscure),
          icon: Icon(
            _obscure
                ? Icons.visibility_outlined
                : Icons.visibility_off_outlined,
            color: AppColors.mute,
            size: 20,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.red),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      ),
    );
  }

  Widget _roleSelector() {
    return Row(
      children: [
        for (int i = 0; i < _roles.length; i++) ...[
          Expanded(child: _segment(_roles[i], roleLabel(_roles[i]),
              selected: _role == _roles[i], onTap: () => _onRoleChanged(_roles[i]))),
          if (i != _roles.length - 1) const SizedBox(width: 8),
        ],
      ],
    );
  }

  Widget _segment(
    String value,
    String label, {
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: _saving ? null : onTap,
      child: Container(
        height: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.ink : AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? AppColors.ink : AppColors.line2,
          ),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: sansStyle(
            size: 13,
            weight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.ink,
          ),
        ),
      ),
    );
  }

  Widget _activeToggle() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.fromLTRB(14, 6, 8, 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Активен',
                  style: sansStyle(
                    size: 14,
                    weight: FontWeight.w500,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  _isActive ? 'Может входить в систему' : 'Доступ заблокирован',
                  style: sansStyle(size: 11, color: AppColors.mute),
                ),
              ],
            ),
          ),
          Switch(
            value: _isActive,
            activeTrackColor: AppColors.ok,
            onChanged:
                _saving ? null : (v) => setState(() => _isActive = v),
          ),
        ],
      ),
    );
  }

  // ─── Salary (waiter) ───────────────────────────────────────────────

  Widget _salarySection() {
    final showAmount = _salaryMode != 'none';
    final percent = _salaryMode == 'percent';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _salaryChip('none', 'Нет'),
            _salaryChip('daily', 'Дневная'),
            _salaryChip('monthly', 'Месячная'),
            _salaryChip('percent', 'Процент'),
          ],
        ),
        if (showAmount) ...[
          const SizedBox(height: 14),
          _label(percent ? 'Процент с заказов' : 'Сумма'),
          const SizedBox(height: 8),
          TextField(
            controller: _salaryController,
            enabled: !_saving,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: numStyle(size: 16, color: AppColors.ink),
            decoration: InputDecoration(
              hintText: '0',
              hintStyle: numStyle(size: 16, color: AppColors.mute2),
              suffixText: percent ? '%' : '₸',
              suffixStyle: sansStyle(size: 14, color: AppColors.mute),
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
      ],
    );
  }

  Widget _salaryChip(String mode, String label) {
    final selected = _salaryMode == mode;
    return GestureDetector(
      onTap: _saving ? null : () => setState(() => _salaryMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? AppColors.ink : AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.ink : AppColors.line2,
          ),
        ),
        child: Text(
          label,
          style: sansStyle(
            size: 12,
            weight: FontWeight.w500,
            color: selected ? Colors.white : AppColors.ink,
          ),
        ),
      ),
    );
  }

  // ─── Food assignment (cook) ────────────────────────────────────────

  Widget _foodSection() {
    if (_menuLoading) {
      return Container(
        height: 120,
        alignment: Alignment.center,
        child: const CircularProgressIndicator(color: AppColors.red),
      );
    }
    if (_menuError != null) {
      return Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.error_outline, size: 18, color: AppColors.mute),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _menuError!,
                style: sansStyle(size: 13, color: AppColors.mute),
              ),
            ),
            TextButton(
              onPressed: _loadMenu,
              child: Text(
                'Повторить',
                style: sansStyle(
                  size: 13,
                  weight: FontWeight.w600,
                  color: AppColors.red,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_categories.isNotEmpty) ...[
          Text(
            'Категории',
            style: sansStyle(size: 12, color: AppColors.mute),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _categories.map((c) {
              final selected = _selectedCategories.contains(c.id);
              return GestureDetector(
                onTap: _saving
                    ? null
                    : () => setState(() {
                          if (selected) {
                            _selectedCategories.remove(c.id);
                          } else {
                            _selectedCategories.add(c.id);
                          }
                        }),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.redSoft : AppColors.surface,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: selected ? AppColors.red : AppColors.line2,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        selected
                            ? Icons.check_circle
                            : Icons.circle_outlined,
                        size: 14,
                        color: selected ? AppColors.red : AppColors.mute2,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        c.title,
                        style: sansStyle(
                          size: 12,
                          weight: FontWeight.w500,
                          color: selected ? AppColors.redInk : AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
        ],
        Text(
          'Отдельные блюда',
          style: sansStyle(size: 12, color: AppColors.mute),
        ),
        const SizedBox(height: 8),
        if (_foods.isEmpty)
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.line),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
            alignment: Alignment.center,
            child: Text(
              'Блюд нет',
              style: sansStyle(size: 13, color: AppColors.mute),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.line),
              borderRadius: BorderRadius.circular(12),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (int i = 0; i < _foods.length; i++) ...[
                  if (i > 0) const Divider(height: 1, color: AppColors.line),
                  _foodTile(_foods[i]),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _foodTile(Food food) {
    final selected = _selectedFoods.contains(food.id);
    return InkWell(
      onTap: _saving
          ? null
          : () => setState(() {
                if (selected) {
                  _selectedFoods.remove(food.id);
                } else {
                  _selectedFoods.add(food.id);
                }
              }),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Icon(
              selected ? Icons.check_box : Icons.check_box_outline_blank,
              size: 20,
              color: selected ? AppColors.red : AppColors.mute2,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                food.name.isEmpty ? 'Без названия' : food.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: sansStyle(
                  size: 14,
                  weight: selected ? FontWeight.w500 : FontWeight.w400,
                  color: AppColors.ink,
                ),
              ),
            ),
            if (food.categoryTitle != null &&
                food.categoryTitle!.isNotEmpty)
              Text(
                food.categoryTitle!,
                style: sansStyle(size: 11, color: AppColors.mute2),
              ),
          ],
        ),
      ),
    );
  }

  Widget _errorBox(String message) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.redSoft,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.red.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.redInk, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: sansStyle(
                size: 13,
                weight: FontWeight.w500,
                color: AppColors.redInk,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
