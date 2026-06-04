import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../models/category.dart';
import '../../models/food.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';

/// Full-screen add/edit menu-item (Блюдо) form. Pops `true` when something was
/// created or updated, so the caller can refresh. Requires the branch's
/// [categories] for the category selector; an empty list is rejected upstream.
class AdminFoodForm extends StatefulWidget {
  const AdminFoodForm({
    super.key,
    required this.categories,
    this.editing,
    this.initialCategoryId,
  });

  final List<Category> categories;
  final Food? editing;
  final String? initialCategoryId;

  @override
  State<AdminFoodForm> createState() => _AdminFoodFormState();
}

class _AdminFoodFormState extends State<AdminFoodForm> {
  final ApiService _api = ApiService.instance;

  final _nameController = TextEditingController();
  final _priceController = TextEditingController();
  final _descController = TextEditingController();

  String? _categoryId;
  bool _isHourly = false;
  bool _saving = false;
  String? _error;

  /// Local path of a freshly picked image (overrides the existing one).
  String? _pickedImagePath;

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.editing;
    if (e != null) {
      _nameController.text = e.name;
      if (e.price > 0) {
        _priceController.text = fmtNumber(e.price).replaceAll(' ', '');
      }
      _descController.text = e.description ?? '';
      _isHourly = e.isHourly;
      _categoryId = e.categoryId;
    }
    _categoryId ??= widget.initialCategoryId;
    if ((_categoryId == null || _categoryId!.isEmpty) &&
        widget.categories.isNotEmpty) {
      _categoryId = widget.categories.first.id;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    FocusScope.of(context).unfocus();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.line2,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 8),
            _sheetItem(ctx, Icons.photo_library_outlined, 'Из галереи',
                ImageSource.gallery),
            _sheetItem(
                ctx, Icons.photo_camera_outlined, 'Камера', ImageSource.camera),
            if (_pickedImagePath != null || widget.editing?.image != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.red),
                title: Text('Убрать изображение',
                    style: sansStyle(size: 14, color: AppColors.red)),
                onTap: () => Navigator.of(ctx).pop(null),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (source == null) return; // sheet dismissed → no change
    try {
      final picker = ImagePicker();
      final XFile? picked = await picker.pickImage(
        source: source,
        maxWidth: 1280,
        imageQuality: 82,
      );
      if (picked != null && mounted) {
        setState(() => _pickedImagePath = picked.path);
      }
    } catch (_) {
      if (mounted) showAdminSnack(context, 'Не удалось выбрать изображение');
    }
  }

  Widget _sheetItem(
      BuildContext ctx, IconData icon, String label, ImageSource src) {
    return ListTile(
      leading: Icon(icon, color: AppColors.ink),
      title: Text(label, style: sansStyle(size: 14, color: AppColors.ink)),
      onTap: () => Navigator.of(ctx).pop(src),
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final name = _nameController.text.trim();
    final price =
        num.tryParse(_priceController.text.trim().replaceAll(' ', '')) ?? -1;

    if (name.isEmpty) {
      setState(() => _error = 'Введите название');
      return;
    }
    if (_categoryId == null || _categoryId!.isEmpty) {
      setState(() => _error = 'Выберите категорию');
      return;
    }
    if (price < 0) {
      setState(() => _error = 'Введите цену');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final desc = _descController.text.trim();
      if (_isEdit) {
        await _api.updateFood(
          widget.editing!.id,
          name: name,
          price: price,
          categoryId: _categoryId!,
          description: desc,
          isHourly: _isHourly,
          imagePath: _pickedImagePath,
        );
      } else {
        await _api.createFood(
          name: name,
          price: price,
          categoryId: _categoryId!,
          description: desc,
          isHourly: _isHourly,
          imagePath: _pickedImagePath,
        );
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
          _isEdit ? 'Редактировать блюдо' : 'Новое блюдо',
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
                  _imageField(),
                  const SizedBox(height: 20),
                  _label('Название'),
                  const SizedBox(height: 8),
                  _textField(
                    controller: _nameController,
                    hint: 'Например: Лагман',
                    enabled: !_saving,
                  ),
                  const SizedBox(height: 20),
                  _label('Категория'),
                  const SizedBox(height: 8),
                  _categorySelector(),
                  const SizedBox(height: 20),
                  _label(_isHourly ? 'Цена за час' : 'Цена'),
                  const SizedBox(height: 8),
                  _textField(
                    controller: _priceController,
                    hint: '0',
                    enabled: !_saving,
                    keyboardType: TextInputType.number,
                    formatters: [FilteringTextInputFormatter.digitsOnly],
                    suffix: '₸',
                  ),
                  const SizedBox(height: 20),
                  _hourlyToggle(),
                  const SizedBox(height: 20),
                  _label('Описание (необязательно)'),
                  const SizedBox(height: 8),
                  _textField(
                    controller: _descController,
                    hint: 'Состав, вес, примечание…',
                    enabled: !_saving,
                    maxLines: 3,
                  ),
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
          label: _isEdit ? 'Сохранить' : 'Добавить блюдо',
          icon: _isEdit ? Icons.check_rounded : Icons.add_rounded,
          busy: _saving,
          expand: true,
          onTap: _submit,
        ),
      ),
    );
  }

  // ─── Image ─────────────────────────────────────────────────────────

  Widget _imageField() {
    return Center(
      child: GestureDetector(
        onTap: _saving ? null : _pickImage,
        child: Container(
          width: 140,
          height: 140,
          decoration: BoxDecoration(
            color: AppColors.surface2,
            border: Border.all(color: AppColors.line2),
            borderRadius: BorderRadius.circular(18),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _imagePreview(),
              Positioned(
                right: 6,
                bottom: 6,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.ink,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.photo_camera_rounded,
                      size: 15, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _imagePreview() {
    if (_pickedImagePath != null) {
      return Image.file(File(_pickedImagePath!), fit: BoxFit.cover);
    }
    final url = ApiService.imageUrl(widget.editing?.image);
    if (url != null) {
      return CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        errorWidget: (_, _, _) => _imagePlaceholder(),
      );
    }
    return _imagePlaceholder();
  }

  Widget _imagePlaceholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.add_a_photo_outlined, size: 26, color: AppColors.mute2),
        const SizedBox(height: 6),
        Text('Фото', style: sansStyle(size: 11, color: AppColors.mute)),
      ],
    );
  }

  // ─── Category selector ─────────────────────────────────────────────

  Widget _categorySelector() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final c in widget.categories)
          _chip(
            label: c.title,
            selected: _categoryId == c.id,
            onTap: () => setState(() => _categoryId = c.id),
          ),
      ],
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: _saving ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? AppColors.ink : AppColors.surface2,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? AppColors.ink : AppColors.line),
        ),
        child: Text(
          label,
          style: sansStyle(
            size: 13,
            weight: FontWeight.w500,
            color: selected ? Colors.white : AppColors.ink2,
          ),
        ),
      ),
    );
  }

  // ─── Hourly toggle ─────────────────────────────────────────────────

  Widget _hourlyToggle() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.timer_outlined, size: 19, color: AppColors.mute),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Почасовая оплата',
                    style:
                        sansStyle(size: 14, weight: FontWeight.w500)),
                const SizedBox(height: 1),
                Text('PlayStation / кабина — цена за час',
                    style: sansStyle(size: 11, color: AppColors.mute)),
              ],
            ),
          ),
          Switch(
            value: _isHourly,
            activeThumbColor: AppColors.red,
            onChanged:
                _saving ? null : (v) => setState(() => _isHourly = v),
          ),
        ],
      ),
    );
  }

  // ─── Field helpers ─────────────────────────────────────────────────

  Widget _label(String text) {
    return Text(
      text,
      style:
          sansStyle(size: 12, weight: FontWeight.w600, color: AppColors.mute),
    );
  }

  Widget _textField({
    required TextEditingController controller,
    required String hint,
    bool enabled = true,
    TextInputType? keyboardType,
    List<TextInputFormatter>? formatters,
    int maxLines = 1,
    String? suffix,
  }) {
    return TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      inputFormatters: formatters,
      maxLines: maxLines,
      style: sansStyle(size: 15, color: AppColors.ink),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: sansStyle(size: 15, color: AppColors.mute2),
        filled: true,
        fillColor: AppColors.surface2,
        suffixText: suffix,
        suffixStyle:
            sansStyle(size: 14, weight: FontWeight.w600, color: AppColors.mute),
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
          const Icon(Icons.error_outline, size: 18, color: AppColors.red),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: sansStyle(size: 13, color: AppColors.redInk)),
          ),
        ],
      ),
    );
  }
}
