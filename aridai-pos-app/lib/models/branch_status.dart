/// Live connectivity of the waiter's branch, from `GET /branches/<id>/status`.
///
/// The global backend reports a branch as **offline** when its local POS
/// backend stopped syncing (stale heartbeat > 45s). A branch with no local
/// backend at all (null heartbeat) is reported **online** — it operates purely
/// through the global API, so the mobile app keeps working.
class BranchStatus {
  final bool online;

  /// Possiz (emergency, no-power) mode — admin-activated. When true, waiter
  /// mobiles may place orders even while the branch is offline, and cooks get
  /// FCM notifications.
  final bool possiz;
  final String currentMode; // online | offline | possiz | unknown | …
  final int? secondsSinceHeartbeat;
  final String? posServerIp;

  const BranchStatus({
    required this.online,
    this.possiz = false,
    this.currentMode = 'unknown',
    this.secondsSinceHeartbeat,
    this.posServerIp,
  });

  bool get offline => !online;

  factory BranchStatus.fromJson(Map<String, dynamic> json) {
    return BranchStatus(
      // Default to online when the field is missing — never block ordering on
      // an ambiguous response.
      online: json['online'] != false,
      possiz: json['possiz'] == true,
      currentMode: (json['currentMode'] ?? 'unknown').toString(),
      secondsSinceHeartbeat: _toIntOrNull(json['secondsSinceHeartbeat']),
      posServerIp: _toStringOrNull(json['posServerIp']),
    );
  }

  static int? _toIntOrNull(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  static String? _toStringOrNull(dynamic v) {
    if (v == null) return null;
    final s = v.toString().trim();
    return s.isEmpty ? null : s;
  }
}
