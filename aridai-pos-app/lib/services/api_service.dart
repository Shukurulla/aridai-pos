import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/category.dart';
import '../models/food.dart';
import '../models/kitchen_item.dart';
import '../models/order.dart';
import '../models/owner_stats.dart';
import '../models/shift.dart';
import '../models/staff.dart';
import '../models/table_model.dart';
import '../models/user.dart';

/// Singleton HTTP client + session store for AridaiPOS.
///
/// Talks to the backend REST API via [dio]. Holds the auth token and the
/// logged-in [User] in memory (mirrored to shared_preferences) so the rest of
/// the app can read them synchronously.
class ApiService {
  ApiService._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _token;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  static final ApiService instance = ApiService._internal();

  /// Dev points at the global backend on the host machine. On a real device or
  /// emulator replace `localhost` with the dev machine's LAN IP
  /// (e.g. `http://192.168.1.10:4560/api`), since `localhost` resolves to the
  /// device itself, not your computer.
  static const String baseUrl = 'http://localhost:4560/api';

  /// Host root (no `/api`) used to resolve relative upload paths into full
  /// image URLs. See [imageUrl].
  static const String fileHost = 'http://localhost:4560';

  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'auth_user';

  late final Dio _dio;

  String? _token;
  User? _currentUser;

  /// The logged-in user, available synchronously after [loadSession].
  User? get currentUser => _currentUser;

  /// Read token + user from prefs into memory. Call once at startup.
  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final userRaw = prefs.getString(_userKey);
    if (userRaw != null && userRaw.isNotEmpty) {
      try {
        final map = jsonDecode(userRaw) as Map<String, dynamic>;
        _currentUser = User.fromJson(map);
      } catch (_) {
        _currentUser = null;
      }
    }
  }

  /// True when an auth token is stored.
  Future<bool> isAuthenticated() async {
    if (_token != null && _token!.isNotEmpty) return true;
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    _token = token;
    return token != null && token.isNotEmpty;
  }

  /// POST /users/login. On success persists the token + user and returns it.
  /// Throws an [Exception] with a human-readable (Russian) message on failure.
  Future<User> login(String phone, String password) async {
    try {
      final response = await _dio.post(
        '/users/login',
        data: {'phone': phone, 'password': password},
      );

      final body = response.data;
      if (body is! Map) {
        throw Exception('Некорректный ответ сервера');
      }

      if (body['status'] == 'success') {
        final data = (body['data'] as Map).cast<String, dynamic>();
        final token = body['token']?.toString();
        await _persistSession(token: token, userData: data);
        return User.fromJson(data);
      }

      throw Exception(_messageFromBody(body));
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) {
        throw Exception(_messageFromBody(data));
      }
      throw Exception(_networkMessage(e));
    }
  }

  // ─── Read-only waiter data (all GET <path>/<branchId>) ─────────────

  /// Tables (and cabins) for the current branch.
  Future<List<TableModel>> getTables() async {
    final data = await _getBranchList('/tables/tables');
    return data
        .whereType<Map>()
        .map((e) => TableModel.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// Menu categories for the current branch.
  Future<List<Category>> getCategories() async {
    final data = await _getBranchList('/categories/all');
    return data
        .whereType<Map>()
        .map((e) => Category.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// Menu items for the current branch.
  Future<List<Food>> getFoods() async {
    final data = await _getBranchList('/foods/all');
    return data
        .whereType<Map>()
        .map((e) => Food.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// All orders for the current branch (waiter-side filtering happens in UI).
  Future<List<OrderModel>> getOrders() async {
    final data = await _getBranchList('/orders/all');
    return data
        .whereType<Map>()
        .map((e) => OrderModel.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  // ─── Cook kitchen queue ────────────────────────────────────────────

  /// The cook's kitchen queue for the current branch. The server already
  /// filters to the cook's assigned foods and only returns items still
  /// needing cooking. Throws an [Exception] with a readable (Russian)
  /// message on any failure.
  Future<List<KitchenItem>> getKitchen() async {
    final data = await _getBranchList('/orders/kitchen');
    return data
        .whereType<Map>()
        .map((e) => KitchenItem.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// Advance a queued dish: PATCH `/orders/<orderId>/items/<itemId>/cooking`
  /// with `{ "status": status }`, where [status] is `"cooking"` or `"ready"`.
  /// Setting `"ready"` removes the item from the queue. Throws an [Exception]
  /// with a readable (Russian) message on any failure.
  Future<void> setCookingStatus(
    String orderId,
    String itemId,
    String status,
  ) async {
    try {
      final response = await _dio.patch(
        '/orders/$orderId/items/$itemId/cooking',
        data: {'status': status},
      );
      final body = response.data;
      if (body is Map && body['status'] == 'success') return;
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) {
        throw Exception(_messageFromBody(data));
      }
      throw Exception(_networkMessage(e));
    }
  }

  // ─── Branch-admin: staff ───────────────────────────────────────────

  /// All staff of the current branch — `GET /users/all/<branchId>`.
  Future<List<StaffMember>> getStaff() async {
    final data = await _getBranchList('/users/all');
    return data
        .whereType<Map>()
        .map((e) => StaffMember.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// Create a staff member — `POST /users/staff`. The branch is derived
  /// server-side from the logged-in admin. [body] carries name/phone/password/
  /// role plus optional salaryMode/salaryAmount and assignedCategories/
  /// assignedFoods. Throws an [Exception] with a readable (Russian) message.
  Future<StaffMember> createStaff(Map<String, dynamic> body) async {
    final data = await _writeJson('post', '/users/staff', body);
    return StaffMember.fromJson(data);
  }

  /// Update a staff member — `PUT /users/<id>`. [body] may contain any of
  /// name/role/isActive/password/salaryMode/salaryAmount/assignedCategories/
  /// assignedFoods. Throws an [Exception] with a readable (Russian) message.
  Future<StaffMember> updateStaff(String id, Map<String, dynamic> body) async {
    final data = await _writeJson('put', '/users/$id', body);
    return StaffMember.fromJson(data);
  }

  /// Delete a staff member — `DELETE /users/<id>`. Throws an [Exception] with a
  /// readable (Russian) message on any failure.
  Future<void> deleteStaff(String id) async {
    try {
      final response = await _dio.delete('/users/$id');
      final body = response.data;
      if (body is Map && body['status'] == 'success') return;
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) throw Exception(_messageFromBody(data));
      throw Exception(_networkMessage(e));
    }
  }

  // ─── Branch-admin: orders ──────────────────────────────────────────

  /// Cancel an order — `PATCH /orders/<id>/cancel` with `{ reason }`. Throws an
  /// [Exception] with a readable (Russian) message on any failure.
  Future<void> cancelOrder(String id, String reason) async {
    try {
      final response = await _dio.patch(
        '/orders/$id/cancel',
        data: {'reason': reason},
      );
      final body = response.data;
      if (body is Map && body['status'] == 'success') return;
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) throw Exception(_messageFromBody(data));
      throw Exception(_networkMessage(e));
    }
  }

  // ─── Cashier: payments ─────────────────────────────────────────────

  /// Settle an order in full — `PATCH /orders/<orderId>/pay` with
  /// `{ paymentMethod, mixed }`. [method] is one of `cash` / `card` /
  /// `transfer` / `mixed`; for `mixed` pass the per-method breakdown via
  /// [mixed] (e.g. `{ cash: 1000, card: 500, transfer: 0 }`). Resolves on a
  /// `success` response; throws an [Exception] with a readable (Russian)
  /// message on any failure.
  Future<void> payOrder(
    String orderId,
    String method, {
    Map<String, num>? mixed,
  }) async {
    try {
      final response = await _dio.patch(
        '/orders/$orderId/pay',
        data: {'paymentMethod': method, 'mixed': mixed},
      );
      final body = response.data;
      if (body is Map && body['status'] == 'success') return;
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) throw Exception(_messageFromBody(data));
      throw Exception(_networkMessage(e));
    }
  }

  // ─── Branch-admin: shifts ──────────────────────────────────────────

  /// All shifts of the current branch — `GET /shifts/all/<branchId>`.
  Future<List<ShiftModel>> getShifts() async {
    final data = await _getBranchList('/shifts/all');
    return data
        .whereType<Map>()
        .map((e) => ShiftModel.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  /// Open a shift — `POST /shifts/create` with `{ branch, openingCash }`.
  /// Returns the created shift; the backend answers 409 when a shift is already
  /// open. Throws an [Exception] with a readable (Russian) message.
  Future<ShiftModel> openShift(num openingCash) async {
    final branchId = _currentUser?.branchId;
    if (branchId == null || branchId.isEmpty) {
      throw Exception('Филиал не определён');
    }
    final data = await _writeJson('post', '/shifts/create', {
      'branch': branchId,
      'openingCash': openingCash,
    });
    return ShiftModel.fromJson(data);
  }

  /// Close a shift — `PUT /shifts/<id>/close` with `{ closingCash }`. Throws an
  /// [Exception] with a readable (Russian) message on any failure.
  Future<ShiftModel> closeShift(String id, num closingCash) async {
    final data = await _writeJson('put', '/shifts/$id/close', {
      'closingCash': closingCash,
    });
    return ShiftModel.fromJson(data);
  }

  // ─── Owner: cross-branch analytics (read-only) ─────────────────────

  /// Revenue analytics across all of the owner's branches —
  /// `GET /owner/stats?period=<today|7d|30d|year>`. The server derives the
  /// restaurant from the owner token, so no branch id is sent. Throws an
  /// [Exception] with a readable (Russian) message on any failure.
  Future<OwnerStats> getOwnerStats(String period) async {
    final data = await _getMap('/owner/stats', query: {'period': period});
    return OwnerStats.fromJson(data);
  }

  /// The owner's branches — `GET /owner/branches` → list of
  /// `{ _id, name, address, isActive }`. Throws an [Exception] with a readable
  /// (Russian) message on any failure.
  Future<List<Map<String, dynamic>>> getOwnerBranches() async {
    final data = await _getList('/owner/branches');
    return data
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList(growable: false);
  }

  /// Resolve a (possibly relative) upload [path] into a full image URL.
  /// Returns null when empty. Already-absolute URLs are returned unchanged.
  static String? imageUrl(String? path) {
    if (path == null) return null;
    final p = path.trim();
    if (p.isEmpty) return null;
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    return p.startsWith('/') ? '$fileHost$p' : '$fileHost/$p';
  }

  /// GET `<path>/<branchId>` and return the `data` list. Throws an
  /// [Exception] with a readable (Russian) message on any failure.
  Future<List<dynamic>> _getBranchList(String path) async {
    final branchId = _currentUser?.branchId;
    if (branchId == null || branchId.isEmpty) {
      throw Exception('Филиал не определён');
    }
    try {
      final response = await _dio.get('$path/$branchId');
      final body = response.data;
      if (body is Map && body['status'] == 'success') {
        final data = body['data'];
        if (data is List) return data;
        return const [];
      }
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) {
        throw Exception(_messageFromBody(data));
      }
      throw Exception(_networkMessage(e));
    }
  }

  /// GET [path] (no branch id appended) with optional [query] and return the
  /// `data` list. Throws an [Exception] with a readable (Russian) message on
  /// any failure.
  Future<List<dynamic>> _getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: query);
      final body = response.data;
      if (body is Map && body['status'] == 'success') {
        final data = body['data'];
        if (data is List) return data;
        return const [];
      }
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) throw Exception(_messageFromBody(data));
      throw Exception(_networkMessage(e));
    }
  }

  /// GET [path] (no branch id appended) with optional [query] and return the
  /// `data` map. Throws an [Exception] with a readable (Russian) message on any
  /// failure.
  Future<Map<String, dynamic>> _getMap(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: query);
      final body = response.data;
      if (body is Map && body['status'] == 'success') {
        final data = body['data'];
        if (data is Map) return data.cast<String, dynamic>();
        return const {};
      }
      throw Exception(
        body is Map ? _messageFromBody(body) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) throw Exception(_messageFromBody(data));
      throw Exception(_networkMessage(e));
    }
  }

  /// Send a JSON write ([method] is `post` or `put`) to [path] and return the
  /// unwrapped `data` map. Throws an [Exception] with a readable (Russian)
  /// message on any failure.
  Future<Map<String, dynamic>> _writeJson(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = method == 'put'
          ? await _dio.put(path, data: body)
          : await _dio.post(path, data: body);
      final data = response.data;
      if (data is Map && data['status'] == 'success') {
        final payload = data['data'];
        if (payload is Map) return payload.cast<String, dynamic>();
        return const {};
      }
      throw Exception(
        data is Map ? _messageFromBody(data) : 'Некорректный ответ сервера',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map) throw Exception(_messageFromBody(data));
      throw Exception(_networkMessage(e));
    }
  }

  /// Clear token + user from prefs and memory.
  Future<void> logout() async {
    _token = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  // ─── internals ─────────────────────────────────────────────────────

  Future<void> _persistSession({
    required String? token,
    required Map<String, dynamic> userData,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (token != null && token.isNotEmpty) {
      _token = token;
      await prefs.setString(_tokenKey, token);
    }
    _currentUser = User.fromJson(userData);
    await prefs.setString(_userKey, jsonEncode(userData));
  }

  /// Translate a structured backend error body into a readable message.
  String _messageFromBody(Map body) {
    final code = body['code']?.toString();
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Неверный телефон или пароль';
      case 'CREDENTIALS_REQUIRED':
        return 'Введите телефон и пароль';
      case 'SHIFT_ALREADY_OPEN':
        return 'Смена уже открыта';
      case 'PHONE_EXISTS':
      case 'DUPLICATE_PHONE':
        return 'Этот номер телефона уже используется';
    }
    final message = body['message']?.toString();
    if (message != null && message.isNotEmpty) return message;
    return 'Произошла ошибка. Попробуйте ещё раз';
  }

  String _networkMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Превышено время ожидания. Проверьте подключение.';
      case DioExceptionType.connectionError:
        return 'Нет соединения с сервером';
      default:
        return e.message ?? 'Ошибка сети';
    }
  }
}
