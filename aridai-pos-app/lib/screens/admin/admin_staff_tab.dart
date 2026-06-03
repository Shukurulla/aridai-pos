import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/staff.dart';
import '../../services/api_service.dart';
import '../../utils/app_colors.dart';
import '../../utils/waiter_design.dart';
import 'admin_common.dart';
import 'staff_form_page.dart';

/// Branch-admin staff management — the priority screen. Lists staff grouped by
/// role with a "+" FAB to add and tap-to-edit / swipe-free delete per row.
class AdminStaffTab extends StatefulWidget {
  const AdminStaffTab({super.key});

  @override
  State<AdminStaffTab> createState() => _AdminStaffTabState();
}

class _AdminStaffTabState extends State<AdminStaffTab> {
  final ApiService _api = ApiService.instance;

  bool _isLoading = true;
  String? _error;
  List<StaffMember> _staff = const [];

  /// staff ids whose delete call is in-flight.
  final Set<String> _busy = <String>{};

  /// Display order of role groups.
  static const _roleOrder = ['branch_admin', 'cashier', 'waiter', 'cook'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_isLoading) setState(() => _isLoading = true);
    try {
      final all = await _api.getStaff();
      if (!mounted) return;
      setState(() {
        _staff = all;
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

  /// Group staff into ordered role sections; unknown roles trail at the end.
  List<({String role, List<StaffMember> members})> get _groups {
    final byRole = <String, List<StaffMember>>{};
    for (final s in _staff) {
      byRole.putIfAbsent(s.role, () => []).add(s);
    }
    final groups = <({String role, List<StaffMember> members})>[];
    for (final role in _roleOrder) {
      final members = byRole.remove(role);
      if (members != null && members.isNotEmpty) {
        groups.add((role: role, members: members));
      }
    }
    // Any remaining roles (owner / system_admin / unknown).
    for (final entry in byRole.entries) {
      groups.add((role: entry.key, members: entry.value));
    }
    return groups;
  }

  Future<void> _openForm({StaffMember? editing}) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => StaffFormPage(editing: editing)),
    );
    if (changed == true) _load();
  }

  Future<void> _confirmDelete(StaffMember member) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Удалить сотрудника?',
          style: sansStyle(size: 16, weight: FontWeight.w600),
        ),
        content: Text(
          '${member.name.isEmpty ? 'Сотрудник' : member.name} будет удалён '
          'без возможности восстановления.',
          style: sansStyle(size: 13, color: AppColors.mute),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Отмена',
              style: sansStyle(size: 14, color: AppColors.mute),
            ),
          ),
          AdminButton(
            label: 'Удалить',
            color: AppColors.red,
            onTap: () => Navigator.of(ctx).pop(true),
          ),
        ],
      ),
    );
    if (ok != true) return;
    if (_busy.contains(member.id)) return;
    setState(() => _busy.add(member.id));
    try {
      await _api.deleteStaff(member.id);
      await _load();
      if (mounted) showAdminSnack(context, 'Сотрудник удалён');
    } catch (e) {
      if (mounted) {
        showAdminSnack(context, e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _busy.remove(member.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      floatingActionButton: (_isLoading || _error != null)
          ? null
          : FloatingActionButton(
              onPressed: () => _openForm(),
              backgroundColor: AppColors.red,
              foregroundColor: Colors.white,
              elevation: 2,
              child: const Icon(Icons.add_rounded, size: 26),
            ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AdminHeader(
              title: 'Сотрудники',
              subtitle: _isLoading
                  ? 'Загрузка…'
                  : '${_staff.length} всего · '
                      '${_staff.where((s) => s.isActive).length} активных',
              trailing: AdminRefreshButton(onTap: _isLoading ? null : _load),
            ),
            Expanded(child: _body()),
          ],
        ),
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
      return _refreshable(
        WaiterEmpty(
          icon: Icons.error_outline,
          title: 'Не удалось загрузить',
          sub: _error,
        ),
      );
    }
    if (_staff.isEmpty) {
      return _refreshable(
        const WaiterEmpty(
          icon: Icons.group_outlined,
          title: 'Сотрудников нет',
          sub: 'Нажмите «+», чтобы добавить',
        ),
      );
    }

    final groups = _groups;
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
        children: [
          for (final g in groups) ...[
            SectionHeader(
              title: roleLabel(g.role),
              sub: '${g.members.length} чел.',
            ),
            ...g.members.map(
              (m) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _StaffCard(
                  member: m,
                  busy: _busy.contains(m.id),
                  onTap: () => _openForm(editing: m),
                  onDelete: () => _confirmDelete(m),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _refreshable(Widget child) {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.red,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: child,
          ),
        ],
      ),
    );
  }
}

/// One staff row — avatar initials, name, role label, phone, salary/assignment
/// hint, an inactive badge, and a delete button. Tapping opens the edit form.
class _StaffCard extends StatelessWidget {
  final StaffMember member;
  final bool busy;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  const _StaffCard({
    required this.member,
    required this.busy,
    required this.onTap,
    required this.onDelete,
  });

  String get _initials {
    final parts =
        member.name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    final letters = parts.take(2).map((p) => p[0].toUpperCase()).join();
    return letters.isEmpty ? '?' : letters;
  }

  /// Short secondary hint: salary for waiters, assignment scope for cooks.
  String? get _hint {
    if (member.role == 'waiter') {
      return salaryLabel(member.salaryMode, member.salaryAmount);
    }
    if (member.role == 'cook') {
      final c = member.assignedCategories.length;
      final f = member.assignedFoods.length;
      if (c == 0 && f == 0) return 'Все блюда';
      final parts = <String>[];
      if (c > 0) parts.add('$c катег.');
      if (f > 0) parts.add('$f блюд');
      return 'Доступ: ${parts.join(' · ')}';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final inactive = !member.isActive;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: inactive ? AppColors.surface2 : AppColors.ink,
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  _initials,
                  style: GoogleFonts.ibmPlexSans(
                    color: inactive ? AppColors.mute : Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            member.name.isEmpty ? 'Без имени' : member.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: sansStyle(
                              size: 15,
                              weight: FontWeight.w500,
                              color: inactive ? AppColors.mute : AppColors.ink,
                            ),
                          ),
                        ),
                        if (inactive) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'Неактивен',
                              style: sansStyle(
                                size: 9,
                                weight: FontWeight.w500,
                                color: AppColors.mute,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (member.phone.isNotEmpty) ...[
                          Text(
                            member.phone,
                            style: numStyle(size: 12, color: AppColors.mute),
                          ),
                        ],
                      ],
                    ),
                    if (_hint != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        _hint!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: sansStyle(size: 11, color: AppColors.mute2),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 4),
              _DeleteButton(busy: busy, onTap: onDelete),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeleteButton extends StatelessWidget {
  final bool busy;
  final VoidCallback onTap;
  const _DeleteButton({required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: busy ? null : onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 36,
          height: 36,
          child: busy
              ? const Center(
                  child: SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor:
                          AlwaysStoppedAnimation<Color>(AppColors.mute),
                    ),
                  ),
                )
              : const Icon(Icons.delete_outline,
                  size: 19, color: AppColors.mute),
        ),
      ),
    );
  }
}
