import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_service.dart';

/// Real-time bridge to the backend's Socket.io server.
///
/// Connects to [ApiService.baseUrl]'s host with the `/api` suffix stripped
/// (e.g. `http://localhost:4560`). On connect it joins the current user's
/// branch room and re-emits the server's `orders:changed` event through a
/// broadcast [onOrdersChanged] stream so screens can live-refresh.
///
/// Everything here tolerates being offline — a missing server just means the
/// stream never fires; the screens keep their pull-to-refresh + timer
/// fallbacks.
class SocketService {
  SocketService._internal();

  static final SocketService instance = SocketService._internal();

  io.Socket? _socket;

  final StreamController<void> _ordersChanged =
      StreamController<void>.broadcast();

  /// Fires (with no payload) whenever the server reports an order changed in
  /// the current branch (`orders:changed`). Listen and reload.
  Stream<void> get onOrdersChanged => _ordersChanged.stream;

  /// True once a live socket connection is established.
  bool get isConnected => _socket?.connected ?? false;

  /// Resolve the socket host from [ApiService.baseUrl] by dropping a trailing
  /// `/api` (and any trailing slash). Falls back to the raw base url.
  static String get _host {
    var url = ApiService.baseUrl;
    if (url.endsWith('/')) url = url.substring(0, url.length - 1);
    if (url.endsWith('/api')) url = url.substring(0, url.length - 4);
    return url;
  }

  /// Open (or reuse) the socket connection. Safe to call more than once —
  /// a live socket is left untouched. Never throws.
  void connect() {
    if (_socket != null) {
      // Already built — make sure it is (re)connecting.
      if (!(_socket!.connected)) _socket!.connect();
      return;
    }

    try {
      final socket = io.io(
        _host,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .enableReconnection()
            .build(),
      );

      socket.onConnect((_) => _join());
      socket.on('orders:changed', (_) {
        if (!_ordersChanged.isClosed) _ordersChanged.add(null);
      });

      _socket = socket;
      // autoConnect handles the initial dial; connect() is a harmless no-op if
      // it is already connecting.
      socket.connect();
    } catch (_) {
      // Offline / bad host — stay silent, fall back to manual refresh.
      _socket = null;
    }
  }

  /// Emit `join` with the current user's branch so the server scopes events.
  void _join() {
    final branchId = ApiService.instance.currentUser?.branchId;
    if (branchId == null || branchId.isEmpty) return;
    _socket?.emit('join', {'branchId': branchId});
  }

  /// Tear the connection down (e.g. on logout). The broadcast stream is kept
  /// open so the singleton can be reused after a later [connect].
  void dispose() {
    final socket = _socket;
    _socket = null;
    if (socket == null) return;
    try {
      socket.dispose();
    } catch (_) {
      // ignore — best-effort cleanup
    }
  }
}
