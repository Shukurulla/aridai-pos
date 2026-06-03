import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/login_screen.dart';
import 'screens/role_router.dart';
import 'services/api_service.dart';
import 'utils/app_colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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
  }

  void _onLogin() {
    setState(() {
      _authed = ApiService.instance.currentUser != null;
    });
  }

  Future<void> _logout() async {
    await ApiService.instance.logout();
    if (!mounted) return;
    setState(() => _authed = false);
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
