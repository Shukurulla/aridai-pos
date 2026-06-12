import 'package:dio/dio.dart';

/// Mobil ilova avtomatik yangilanish tekshiruvi.
/// GitHub Releases'dan eng so'nggi `app-v<X.Y.Z>` relizini topadi va joriy versiya bilan
/// solishtiradi. Yangi bo'lsa — UpdateInfo qaytaradi (UI dialog ko'rsatadi, APK'ni yuklaydi).
///
/// MUHIM: [currentVersion] ni `pubspec.yaml` dagi `version:` bilan bir xil tuting (CI release
/// `app-v<pubspec version>` tegi bilan chiqaradi).
class UpdateInfo {
  final String version;
  final String apkUrl;
  final String notes;
  const UpdateInfo({required this.version, required this.apkUrl, required this.notes});
}

class UpdateService {
  // MUHIM: pubspec.yaml `version:` bilan BIR XIL bo'lsin (release tegi shundan).
  // Aks holda yangilangach app o'zini eski deb biladi → update loop.
  static const String currentVersion = '1.9.1';
  static const String _repo = 'Shukurulla/aridai-pos'; // owner/repo
  static const String _tagPrefix = 'app-v';

  /// "1.2.3" larni solishtiradi: a>b → 1, a==b → 0, a<b → -1
  static int _cmp(String a, String b) {
    final pa = a.split('.').map((x) => int.tryParse(x.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0).toList();
    final pb = b.split('.').map((x) => int.tryParse(x.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0).toList();
    for (var i = 0; i < 3; i++) {
      final x = i < pa.length ? pa[i] : 0;
      final y = i < pb.length ? pb[i] : 0;
      if (x != y) return x > y ? 1 : -1;
    }
    return 0;
  }

  /// Yangilanish bormi? Bo'lsa UpdateInfo, bo'lmasa/xato bo'lsa null.
  static Future<UpdateInfo?> check() async {
    try {
      final res = await Dio().get(
        'https://api.github.com/repos/$_repo/releases',
        options: Options(headers: {'Accept': 'application/vnd.github+json'}, receiveTimeout: const Duration(seconds: 8)),
      );
      final list = (res.data as List?) ?? [];
      for (final r in list) {
        final tag = (r['tag_name'] ?? '').toString();
        if (!tag.startsWith(_tagPrefix)) continue;
        final ver = tag.substring(_tagPrefix.length);
        if (_cmp(ver, currentVersion) <= 0) return null; // eng so'nggi app-v yangi emas
        String apk = '';
        for (final a in (r['assets'] as List?) ?? []) {
          final name = (a['name'] ?? '').toString();
          if (name.toLowerCase().endsWith('.apk')) {
            apk = (a['browser_download_url'] ?? '').toString();
            break;
          }
        }
        return UpdateInfo(version: ver, apkUrl: apk, notes: (r['body'] ?? '').toString());
      }
      return null;
    } catch (_) {
      return null; // offline yoki xato — sukut bilan o'tkazamiz
    }
  }
}
