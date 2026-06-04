import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'screens/login_screen.dart';
import 'screens/role_router.dart';
import 'services/api_service.dart';
import 'services/branch_status_service.dart';
import 'services/push_service.dart';
import 'utils/app_colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // FCM (push) — Firebase sozlanmagan bo'lsa ham ilova ishlaydi (guard).
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  } catch (_) {/* Firebase config yo'q — push o'chiq, ilova davom etadi */}
  await ApiService.instance.loadSession();
  runApp(const AridaiPosApp());
}

class AridaiPosApp extends StatelessWidget {
  const AridaiPosApp({super.key});

  @override
  Widget build(BuildContext context) {
    final baseTextTheme = GoogleFonts.ibmPlexSansTextTheme(
      Theme.of(context).textTheme,
    ).apply(
      bodyColor: AppColors.ink,
      displayColor: AppColors.ink,
    );

    return MaterialApp(
      title: 'AridaiPOS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.bg,
        colorScheme: const ColorScheme.light(
          primary: AppColors.red,
          onPrimary: Colors.white,
          surface: AppColors.surface,
          onSurface: AppColors.ink,
          error: AppColors.red,
        ),
        textTheme: baseTextTheme,
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.bg,
          elevation: 0,
          scrolledUnderElevation: 0,
          foregroundColor: AppColors.ink,
          iconTheme: const IconThemeData(color: AppColors.ink),
          titleTextStyle: baseTextTheme.titleLarge?.copyWith(
            color: AppColors.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      home: const AuthWrapper(),
    );
  }
}

/// Decides between the login screen and the role router based on the stored
/// session, and wires up login/logout transitions.
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _loading = true;
  bool _authed = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final authed = await ApiService.instance.isAuthenticated();
    if (!mounted) return;
    setState(() {
      _authed = authed && ApiService.instance.currentUser != null;
      _loading = false;
    });
    if (_authed) {
      PushService.instance.init(); // qurilma tokenini ro'yxatga olamiz
      _startBranchStatus();
    }
  }

  void _onLogin() {
    setState(() {
      _authed = ApiService.instance.currentUser != null;
    });
    if (_authed) {
      PushService.instance.init();
      _startBranchStatus();
    }
  }

  Future<void> _logout() async {
    BranchStatusService.instance.stop();
    await PushService.instance.dispose(); // tokenni o'chiramiz (token hali bor)
    await ApiService.instance.logout();
    if (!mounted) return;
    setState(() => _authed = false);
  }

  /// Offline-awareness polling — only for branch-bound roles (waiter / cook /
  /// cashier / admin). Owner / system_admin have no single-branch context.
  void _startBranchStatus() {
    const branchRoles = {'waiter', 'cook', 'cashier', 'branch_admin'};
    final role = ApiService.instance.currentUser?.role ?? '';
    if (branchRoles.contains(role)) {
      BranchStatusService.instance.start();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.red),
          ),
        ),
      );
    }

    final user = ApiService.instance.currentUser;
    if (_authed && user != null) {
      return RoleRouter(user: user, onLogout: _logout);
    }
    return LoginScreen(onLoginSuccess: _onLogin);
  }
}
