import 'package:firebase_messaging/firebase_messaging.dart';

import 'api_service.dart';

/// Background xabar handleri (ilova yopiq/orqada). Notification payload'ni tizim
/// avtomatik ko'rsatadi — bu yerda qo'shimcha ish shart emas. Top-level + @pragma SHART.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {}

/// FCM push — qurilma tokenini olib backend'ga yuboradi (cook/waiter bildirishnoma).
/// Firebase sozlanmagan/ruxsat berilmagan bo'lsa — xavfsiz (xato bermaydi).
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  String? _token;
  bool _started = false;

  /// Login bo'lgandan KEYIN chaqiriladi (Bearer token kerak — token backend'ga bog'lanadi).
  Future<void> init() async {
    if (_started) return;
    _started = true;
    try {
      final m = FirebaseMessaging.instance;
      await m.requestPermission(alert: true, badge: true, sound: true);
      _token = await m.getToken();
      if (_token != null) await _send(_token!);
      m.onTokenRefresh.listen((t) {
        _token = t;
        _send(t);
      });
    } catch (_) {
      _started = false; // keyin qayta urinishga ruxsat
    }
  }

  Future<void> _send(String token) async {
    try {
      await ApiService.instance.registerPushToken(token);
    } catch (_) {/* offline — keyingi safar */}
  }

  /// Logout — qurilma tokenini backend'dan o'chiradi.
  Future<void> dispose() async {
    try {
      if (_token != null) await ApiService.instance.unregisterPushToken(_token!);
    } catch (_) {}
    _started = false;
    _token = null;
  }
}
