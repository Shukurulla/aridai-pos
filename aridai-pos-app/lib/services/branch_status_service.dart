import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api_service.dart';

/// Polls the branch's offline-status from the global backend and exposes it as
/// a [ValueNotifier] so any screen can react (banner / disable ordering).
///
/// Design: the waiter mobile never connects to the local POS backend; instead
/// the global VPS tracks each branch's local-backend heartbeat and tells the
/// mobile when the branch went offline (see obsidian `offline-rejim.md`).
///
/// A failed poll (the phone itself has no internet) leaves the last known value
/// untouched — we never flip to "offline" on a transient mobile-network blip,
/// because order submits will surface their own network error in that case.
class BranchStatusService {
  BranchStatusService._();
  static final BranchStatusService instance = BranchStatusService._();

  static const Duration _interval = Duration(seconds: 15);

  /// True while the branch is reachable/online. Defaults to true.
  final ValueNotifier<bool> online = ValueNotifier<bool>(true);

  Timer? _timer;

  /// Begin polling. Safe to call repeatedly (restarts the timer).
  void start() {
    stop(reset: false);
    _poll();
    _timer = Timer.periodic(_interval, (_) => _poll());
  }

  /// Stop polling. [reset] returns the notifier to the optimistic "online"
  /// default (used on logout).
  void stop({bool reset = true}) {
    _timer?.cancel();
    _timer = null;
    if (reset) online.value = true;
  }

  Future<void> _poll() async {
    final status = await ApiService.instance.getBranchStatus();
    if (status == null) return; // network/unknown — keep last known state
    if (online.value != status.online) {
      online.value = status.online;
    }
  }
}
